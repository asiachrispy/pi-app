# Kocoro 引擎安全层 → pi 移植开发计划（按价值排序）

**版本**：2026-06-08 · **范围**：6 个模块（权限/校验/死循环/并发/图像/上下文预算）按 ROI 排序
**源**：Kocoro `internal/permissions/`、`internal/agent/{tools,loopdetect,concurrency_safe,oversize_image,spill,toolresult_budget}.go`、`internal/tools/{bash_concurrency,imaging_compress}.go`

---

## 价值排序总览

| 排名 | 模块 | 价值 | 代码量 | 工期 | 依赖 |
|------|------|------|--------|------|------|
| **#1** | **上下文预算**（3 层 spill） | ★★★★★ 每个长会话都受益 | ~500 行 | 2 周 | 无 |
| **#2** | **ValidationError + LoopDetect** | ★★★★★ 防 stuck loop 灾难 | ~600 行 | 2 周 | #1 的 ErrorCategory |
| **#3** | **图像保护**（3 层） | ★★★★ pi-web 用户高频 | ~300 行 | 1.5 周 | 无 |
| **#4** | **IsConcurrencySafeCall** | ★★★★ 并行性能提升 | ~250 行 | 1 周 | 无 |
| **#5** | **权限系统**（5 段） | ★★★ 企业刚需 · 体量最大 | ~1400 行 | 3 周 | #2 的 ValidationError |

---

## #1 上下文预算（3 层 spill）— 价值最高

### 为什么排第一

pi 用户每次长会话必然触及上下文窗口上限。Kocoro 三层预算直接解决"模型读到第 15 轮后上下文爆了"的问题。pi 当前没有任何同等机制——这是 **pi 引擎最薄弱的环节**，也是修复后受益最广的一项。

### 从 Kocoro 搬什么

| Kocoro 源 | 行数 | 核心算法 |
|-----------|------|---------|
| `agent/spill.go` | 134 | `spillToDisk` + `applyAggregateCap`（选最大 spill）+ `cleanupSpills` |
| `agent/toolresult_budget.go` | 278 | `ToolResultReplacementState`（persisted map）+ `applyToolResultBudget`（跨 turn）+ `safeSpillSessionID`（防目录穿越） |

### 三层设计

```
L1: per-result spill      单结果 > 50K rune → 落盘 tmp/ + 2000 字 preview
L2: per-turn aggregate    当前轮所有结果总合 > 200K rune → 选最大的 spill
L3: persisted replacement  spill 后的 tool_use_id→替换内容 映射跨 turn 持久
                            (crash recovery 后也恢复 — 防 prompt-cache 漂移)
```

### 关键技术细节

1. **Persisted replacement map**：`ToolResultReplacementState.Replacements` 存 `tool_use_id → 替换内容`。跨 turn 命中时直接写入而不重新 spill——保持 `prompt-cache prefixes do not drift`。

2. **Clone-on-write 语义**：只在真的有替换发生时 clone message 切片。Kocoro phase C 优化后 99% 路径零分配。

3. **安全的文件名**：`safeSpillSessionID` + `safeToolResultBudgetID`——非 `[a-zA-Z0-9_.-]` 全部替换为 `_`，最长 120 字符。防 `sessionID="../../etc"` 目录穿越。

4. **Unlimited 工具豁免**：`file_read` 等声明 `UnlimitedToolResultSizeChars` 的工具跳过 spill。原因：spill → 模型读 spill file（又是 file_read）→ 再次 spill → **死循环**。

5. **Dirty exit 日志**：当只剩 Unlimited 工具时无法再 spill，写 `"applyAggregateCap dirty exit"` 日志留痕。

### pi 落点

```
packages/coding-agent/src/core/tools/budget.ts  （~500 行）
  - spillToDisk(path, content) → preview
  - applyAggregateCap(results, opts)
  - applyToolResultBudget(messages, state, opts)  ← 跨 turn 版本
  - ToolResultReplacementState（Session 级持久）
```

### 验收

- [ ] 单结果 > 50K chars → 落盘 + preview 正确
- [ ] 10 个 30K 结果 → aggregate 选最大的 4-5 个 spill
- [ ] 第 2 轮：replacement map 命中 → 不重新 spill → 内容不变
- [ ] crash recovery：重启后 map 恢复 → 同一 tool_use_id 的结果保持替换
- [ ] `file_read` 结果永不被 spill
- [ ] 恶意 sessionID 不逃逸目录

---

## #2 ValidationError + LoopDetect — 防灾难

### 为什么排第二

这是 Kocoro **唯一记载了生产事故根因的模块**（2026-05-13 stuck loop）。pi 虽然 stuck loop 频率可能比 Kocoro 低（pi 用户是开发者，会手动 Ctrl-C），但一旦发生——`file_write` 无 content → 写 0 字节 → 截断用户文件 → 16 次重试——损失是真实的。ValidationError 的 `[validation error]` 前缀是 LoopDetect 区分"参数就是错的"和"网络抖动"的**唯一信号**。

### 从 Kocoro 搬什么

| Kocoro 源 | 行数 | 核心 |
|-----------|------|------|
| `agent/tools.go` | 40（ValidationError 工厂 + ErrorCategory 类型） | `[validation error]` 前缀 + 4 类 |
| `agent/loopdetect.go` | 507 | 9 条规则 + recovery 检测 + batchTolerant |

### 关键技术细节

#### ValidationError 工厂

```typescript
function ValidationError(msg: string): ToolResult {
  return {
    content: `[validation error] ${msg}`,
    isError: true,
    errorCategory: 'validation',
  };
}
```

**Kocoro AGENTS 的不变量**：每个工具的 `Run()` 必须立刻检查 `Required` 字段非零，失败返回 `ValidationError`（不是 bare `ToolResult`）。

#### LoopDetect 9 条规则（按触发顺序）

| # | 规则 | 阈值 | 做什么 |
|---|------|------|--------|
| 0a | **EmptyThinkForceStop** | 2 连 | think({}) 空内容 → stop |
| 0 | **ToolModeSwitch** | 1 次 | GUI 成功 → 又截图（冗余）→ nudge |
| 0b | **SuccessAfterError** | 1 次 | 恢复后 → 又截图 → nudge |
| 1a | **ConsecutiveDup** | 3→nudge / 4→stop | 连续相同调用 |
| 1a-pre | **ValidationShortCircuit** | 3 连相同 args + 全部 validation error → **立即 stop** | 同参数同校验错重试没用 |
| 1b | **ExactDup** | 5→nudge / 10→stop | 窗口内散列重复 |
| 2 | **SameToolError** | 6→nudge / 12→stop | 同工具反复失败 |
| 3 | **FamilyNoProgress** | 5/8/12 | 同族工具同 topic 反复 |
| 4 | **SearchEscalation** | 7/12 | 连续无产出搜索 |
| 5 | **NoProgress** | 12→nudge / 24→stop | 同工具过多调用 |

#### Validation 短路的设计

```go
if consecValidationErrCount >= 3 && consecValidationErrCount == consecCount {
    return LoopForceStop, "Tool rejected your arguments 3 times... fix or ask user."
}
```

关键条件：**validation 错误数 == 完全连续相同调用数**。如果是 3 次调用但有 1 次 transient → 不走短路 → transient 可能是网络问题 → 走 all-errors 2x 预算（到 #7 才停）。

#### Recovery 检测

```go
recovered := consecCount > 0 &&
    !ld.history[len(ld.history)-1].IsError &&
    consecErrCount > 0
```

最后一条成功 + 之前有错 → skip ExactDup。模型刚从错误恢复，不应该被惩罚。

#### batchTolerant

bash 和 MCP read 工具：窗口内 50%+ 调用携带不同 `argsHash` → 视为合法的批量操作，不触发 NoProgress——**防止生产 false positive**。

### pi 落点

```
packages/coding-agent/src/core/tools/result.ts    （~60 行）
  - ErrorCategory enum
  - ValidationError / TransientError / BusinessError / PermissionError 工厂

packages/coding-agent/src/core/loopdetect.ts       （~540 行）
  - LoopDetector class（sliding window 20）
  - 9 条规则全部移植
  - BatchTolerant 机制
```

### 验收

- [ ] `file_write` 缺 content → `[validation error] content is required` → `errorCategory='validation'`
- [ ] 3 连相同 args + validation error → LoopForceStop（不是等到 #7）
- [ ] 2 连 error + 1 个 transient（同 args）→ 不走短路 → 走 all-errors 2x
- [ ] 错误恢复后 → ExactDup skip
- [ ] bash 50%+ distinct args → NoProgress skip（batchTolerant）
- [ ] Drift test：Kocoro `loopdetect_test.go` fixture 在 TS 侧跑通

---

## #3 图像保护（3 层）— pi-web 用户高频

### 为什么排第三

pi-web 的用户**上传截图和文件**是高频操作。Kocoro 的 3 层保护直接防 Anthropic 的 `400 image too large` 和多图场景下 `2000px` 维度限制。pi 当前只有 `utils/image-resize.ts`（单一 resize），没有 wire-time 和 persist-time 的任何防护。

### 从 Kocoro 搬什么

| Kocoro 源 | 行数 | 核心 |
|-----------|------|------|
| `agent/oversize_image.go` | 293 | 3 层检查 + image.DecodeConfig 只读 header + DoS 防护 |
| `tools/imaging_compress.go` | 125 | source-time 压缩 + 64MP 像素预算 + 4 级质量回退 |

### 三层设计

```
L0: many-image dimension   图 > 20 张时 → 每张边长 ≤ 2000px
L1: per-image 5MB         单张 base64 > 5MB → placeholder
L2: aggregate 25MB        全部图 base64 总合 ≤ 25MB → 从最老的开始删
+ source compress          原始图 > TargetRawImageBytes → JPEG 压缩（4 级回退）
```

### 关键技术细节

1. **DecodeConfig header-only**：`image.DecodeConfig` 只读几十字节 header（PNG IHDR / JPEG SOFn / GIF LSD / WebP VP8）——不分配像素缓冲区。一张 2588×690 px 的截图 zlib 后只有 600KB，滑过 per-image 5MB 字节阈值，但 L0 维度检查 catch 住。

2. **64MP 像素预算**：纯色 PNG（100000×100000 px）zlib RLE 压缩后几百 KB——滑过字节阈值但 `image.Decode` 会分配 ~40GB RGBA。预算在 `DecodeConfig` 阶段拒绝。

3. **Aggregate 溢出策略**：从最老的消息开始逐张 delete，不是全删。20 页 PDF 转成 20 张图只删前 2-3 张。

4. **Cache-compact 事件**：每种 strip 都记 `img_dim_strip` / `img_oversize_strip` / `img_aggregate_strip` 到 cache-debug.log，方便排查。

### pi 落点

```
packages/coding-agent/src/core/tools/image-protection.ts  （~300 行）
  - filterOversizeImages(messages) — 3 pass
  - enforcePerImageDimensionCap（>20 图时触发）
  - enforceAggregateImageCap（25MB 总合）
  - compressImage 复用 pi 已有 resize + 加 4 级质量回退
```

### 验收

- [ ] 单张 8MB PNG → per-image pass 替换为 placeholder
- [ ] 25 张 1.2MB 截图 → L0 维度检查触发（全 > 20 张）→ 边长大于 2000 的替换
- [ ] 40 张 600KB 图 → aggregate 触发 → 从最老的删到 25MB 以下
- [ ] 声明 100000×100000 的 header → 64MP 预算拒绝
- [ ] source compress：6MB PNG → JPEG 质量 80→60→40 回退 → 全部 ≤ 3MB 为止

---

## #4 IsConcurrencySafeCall — 并行性能

### 为什么排第四

这是**性能提升**而非安全防御。pi 当前的 dispatcher 用 `IsReadOnly` 做批处理依据——所有 read tool 可以并行，所有 write tool 串行。Kocoro 的 `IsConcurrencySafeCall` 让部分有写入能力的工具（特别是 bash）在白名单命令下也能并行——`ls -la` + `cat foo` + `grep bar` 可以同时跑，不被 bash 串行 block。

### 从 Kocoro 搬什么

| Kocoro 源 | 行数 | 核心 |
|-----------|------|------|
| `agent/concurrency_safe.go` | 21 | 接口定义 |
| `tools/bash_concurrency.go` | 220 | Bash 白名单 + metachar scan + blocking device guard + git subcommand analysis |

### 关键技术细节

#### 两步判定

```
Step 1: Metachar 扫描
  cmd 包含 && || | > $ ( ` ; & \n \r 任一 → 永不并发

Step 2: 白名单匹配
  第一 token 在 21 个已知安全命令中：
    通白: ls pwd which echo whoami id uname true false ...
    条件白:
      cat/head/wc/stat/file  → 拒绝 /dev/random /dev/urandom /dev/zero /dev/tty*
      tail                   → 拒绝 -f/-F/--follow  + 阻塞设备
      env                    → 仅裸 env 无参数
      git                    → status/diff/log/show/branch(不带删标志)/config --get ...
      go                     → version/list/doc/env(不带 -w/-u)
      date                   → 仅 +format 参数
      hostname               → 仅 flag 无 positional
    版本仅: node/python/python3 --version（其余全拒绝）
```

#### Fail-closed

任何不在白名单的 token → 永不被并发。`git push`、`npm install`、`curl` 都被挡。

#### Default fallback

未实现 `ConcurrencySafeChecker` 的 tool 走 `IsReadOnly` → **零破坏旧行为**。

### pi 落点

```
packages/coding-agent/src/core/tools/concurrency.ts  （~250 行）
  - ConcurrencySafeChecker interface
  - IsCommandConcurrencySafe(command) 白名单判定
  - Dispatcher 改用此接口分组
```

### 验收

- [ ] `ls -la; cat foo; grep bar` 三条 bash → 3 路并发（同一个 batch）
- [ ] `git push origin main` → 串行（batch size 1）
- [ ] `npm install express` → 串行
- [ ] `cat /dev/urandom` → 串行（blocking device）
- [ ] `tail -f /var/log/syslog` → 串行（follow mode）
- [ ] 未实现接口的 tool → 走 IsReadOnly 旧逻辑

---

## #5 权限系统（5 段）— 体量最大 · 企业刚需

### 为什么排最后

1892 行的核心逻辑 + shell tokenizer + git subcommand 分析 + command family matching——这是**最复杂的单个模块**。但它也是**最独立的**——不影响其他 4 个模块。可以在前 4 个稳定后在独立的 3 周内完成。

pi 的 `AGENTS.md` 明确说"no built-in permission system"——这就是 Kocoro 最厚的可吸收模块。

### 从 Kocoro 搬什么

| Kocoro 源 | 行数 | 核心 |
|-----------|------|------|
| `permissions/permissions.go` | 1892 | 全部 |

### 五段管道

```
Hard-block (14 patterns) → Denied_commands → Always-ask (42 prefixes) → Allowed_commands → DefaultSafe (400+) → Ask
```

### 必须搬的关键子组件

#### 1. shell tokenizer（`shellTokens`，140 行）

正确处理单双引号 / `$(...)` / `` ` `` backtick 嵌套。这是后续所有 Bash 分析的基础。

#### 2. 复合命令拆分（`splitCompoundCommand`，180 行）

`cmd1 && cmd2 || (python3 -c 'evil')` → `["cmd1", "cmd2", "python3 -c 'evil'"]`。每个子命令独立过 5 段。

#### 3. Always-ask 判定（`isAlwaysAskSingle`，含 `isAlwaysAskGitPush`）

6 层分析：normalizeExe → alwaysAskPrefixes → minusMExempt → gitPushDangerFlags → hasTrailingBackground → redirect strip。

#### 4. 命令族匹配（`prefixDepthTable` + `commandPrefixMatch`）

`git` 取前 N=2 个非 flag token → `git push` 和 `git status` 是不同族。strip redirect 和 safe 命令后再匹配。Cross-product 匹配支持复合 entry。

#### 5. 安全内置列表（`defaultSafeCommands`，300+ 条目）

按类别：system info / checksums / text processing / file finding / process / network / git read-only / versions / build & test / linters / package queries / docker read-only / k8s read-only / terraform read-only / gh read-only / aws read-only / gcp read-only / macOS system info。

### pi 落点

```
packages/coding-agent/src/core/permissions/
  permissions.ts       (~400 行) — 5 段管道 + 复合拆分
  shell-tokenizer.ts   (~150 行) — shellTokens + splitCompoundCommand
  always-ask.ts        (~200 行) — isAlwaysAskSingle + isAlwaysAskGitPush
  command-family.ts    (~150 行) — prefixDepthTable + commandPrefixMatch
  default-safe.ts      (~300 行) — 300+ 内置安全命令
  file-check.ts        (~100 行) — CheckFilePath + IsSensitiveFile
  network-check.ts     (~80 行)  — CheckNetworkEgress
```

### 验收

- [ ] 5 段顺序不可逆（hard-block 永不被 allowlist 覆盖）
- [ ] 复合命令 `cmd1 && sudo rm -rf /` → 子命令逐段判定 → hard-block deny
- [ ] 引号内操作符不被切割（`echo "a && b"` 是单段）
- [ ] `git -C /tmp push --force-with-lease` → always-ask（全局选项绕过检测）
- [ ] `python3 -m pytest` → minusMExempt（不走 always-ask）
- [ ] `agent-browser click X && agent-browser wait 2` → entry 允许多个子命令单独匹配
- [ ] allowed `git status` 不匹配 `git push`（N=2 prefixDepthTable）
- [ ] `cat .env` → IsSensitiveFile → ask

---

## 分周执行表

| 周 | 模块 | 交付 |
|----|------|------|
| **W1** | #1 上下文预算 L1+L2 | per-result spill + aggregate cap |
| **W2** | #1 上下文预算 L3 | persisted replacement map + crash recovery |
| **W3** | #2 ValidationError | ToolResult 加 ErrorCategory + 4 工厂 |
| **W4** | #2 LoopDetect | 9 条规则 + recovery + batchTolerant |
| **W5** | #3 图像保护 L0+L1 | dimension cap + per-image 5MB cap |
| **W6** | #3 图像保护 L2 + source compress | aggregate 25MB + 4 级 JPEG 回退 + 64MP 预算 |
| **W7** | #4 IsConcurrencySafeCall | 接口 + Bash 白名单 + dispatcher 改接 |
| **W8** | #5 权限 L1+L2 | hard-block + denied + always-ask + shell tokenizer |
| **W9** | #5 权限 L3+L4 | allowed_commands + defaultSafe（300+ 条目） |
| **W10** | #5 权限 L5 | command family matching + 文件/网络检查 + 集成 |

---

## 每阶段的关键不变量（不能打破的）

| 阶段 | 不变量 |
|------|--------|
| #1 | `file_read` 的 Unlimited 工具永不被 spill · 恶意 sessionID 不穿目录 · crash recovery 恢复 map |
| #2 | `[validation error]` 前缀仅一处生成 · validation 短路仅当 3 连 + 全部 validation · recovery skip ExactDup |
| #3 | L0 仅当 >20 图触发 · L2 从最老删不是全删 · 64MP 预算在 DecodeConfig 阶段（不分配像素） |
| #4 | 未实现接口的 tool 走 IsReadOnly 旧逻辑 · fail-closed（不在白名单→串行） · metachar 永远不并发 |
| #5 | hard-block 不被 config 覆盖 · always-ask 在 allowlist 之前 · 引号内不被切割 · compound 全子命令过 5 段 |
