# Kocoro → pi 吸收计划 v8

**版本**：2026-06-08 · **方向**：Kocoro（Go daemon）→ pi（pi-coding-agent TS 运行时 + pi-web）吸收
**前置阅读**：[AGENTS.md](../AGENTS.md) · [CLAUDE.md](../CLAUDE.md) · [pi 总览](https://github.com/earendil-works/pi-mono) · [pi-web 总计划](https://github.com/earendil-works/pi-web/blob/main/docs/plan-pi-web-macos-workbench.md)

---

## 0. 摘要

pi 与 Kocoro 形态互补、能力堆栈不同层：

| 维度 | pi / pi-web | Kocoro |
|------|-------------|--------|
| 语言/形态 | TypeScript · Next.js Web + pi-coding-agent CLI/TUI | Go · daemon + Cloud WS |
| 版本 | `@earendil-works/pi-coding-agent@0.78.2` · `pi-app@0.7.5` | `github.com/Kocoro-lab/ShanClaw` |
| 强项 | 分支树 / Fork·Clone / 场景 / Web Push / E2EE Relay / BranchSummary | **生产硬化 / 多通道 / 企业生态** |
| 引擎规模 | `agent-session.ts`(3079L) + `compaction/`(2108L) + `extensions/`(3707L) + `session-manager.ts`(1567L) | `agent/` 34 文件(~6000L) + `tools/` 60+ 工具 + `daemon/` (~20000L) |

## 吸收动机

pi 已在「用户可见」层做得很深（分支/场景/Web Push/E2EE）。缺失的是 Kocoro 三年沉淀下来的**引擎级生产硬化**和**多通道 + 企业化**能力。吸收后 pi 能：

1. **不炸**（权限/校验/stuck loop 防御/并发安全）——当前 pi `AGENTS.md` 明确说"no built-in permission system"
2. **跨通道进来**（Feishu·Slack·Telegram·Webhook）——当前 pi 只有 CLI/Web 入口
3. **企业上得去**（Keychain·市场·迁移·同步·审计）

下面 30 项分 K1(必修)/K2(进阶)/K3(战略)。

---

## 1. pi 已有什么（避免重复造轮子）

> **这些大方向 Kocoro 本身反而缺少**——吸收时注意**不要**反向削弱 pi 的领先点。

| pi 能力 | 落点 | Kocoro 对应 |
|---------|------|------------|
| **分支树 + Fork + Clone** | `branch-tree.ts` + `agent-session-tree.test.ts` + `RPC fork_session/clone_session` | 只有 `rewind`（线性回退），无双线分支 |
| **BranchSummary（分支摘要）** | `compaction/branch-summarization.ts`(368L) | 无 |
| **场景（Scene）+ 场景包** | `scenes.ts` + `scene-overrides.ts` + `scene-pack.ts` | 无 |
| **Web Push + Service Worker** | `push-notifications.ts` + `public/sw.js` | 仅 macOS 本地通知 |
| **E2EE Relay（X25519+AES-GCM）** | `lib/pi-relay/{crypto,connection-offer,http-relay,tunnel}.ts` | 无 |
| **Web Fetch 三档** | T0 JSON-LD / T1 Readability / T2 WKWebView（pi-web） | 仅单档 `http.go` |
| **i18n（zh-CN/en）** | `lib/i18n/`（pi-web） | 英文硬编码居多 |
| **工具三档预设** | `tool-presets.ts`（pi-web） | 无命名预设 |
| **Compaction + CutPoint** | `compaction/compaction.ts`(876L) + `findCutPoint` | 有但走 Go 自己写 |
| **SessionManager（jsonl + schema 迁移）** | `session-manager.ts`(1567L) | 有（`session/manager.go`+`store.go`） |
| **Extention 系统** | `extensions/`(3707L) | 无 |
| **RPC client/server** | `modes/rpc/` | 有 `desktop_rpc/` |
| **AuthStorage（auth.json）** | `auth-storage.ts`(533L) | 有 `auth.go`（Keychain-backed） |

## 2. Kocoro → pi 可吸收的 30 项

> 评分 = ★★★(立即)·★★(近期)·★(未来)；全部以 Kocoro 已跑过单测的文件为源。

---

### K1：生产硬化（必修，8–10 周）

#### K1-01 权限系统（5 段：hard-block → denied → always-ask → allowed → default safe → ask） ★★★

**Kocoro 源**：`internal/permissions/permissions.go`（1891 行，hardBlockPatterns + alwaysAskPrefixes + denied_commands + 子命令递归拆分）

**pi 现状**：`AGENTS.md` 原文："Pi does not include a built-in permission system for restricting filesystem, process, network, or credential access."

**移植**：`packages/coding-agent/src/core/permissions/`（新）。5 段解析 + 复合命令拆分 + `&` 后台启动检测。**关键不变量**：always-ask 永跑在 allowlist 之前；hard-block 不随 config 关闭。

**单测**：每段 1 项 + hardBlock 单测（`rm -rf /` 永不可过）+ drift test（Kocoro Go 单测 fixture 对照）。

---

#### K1-02 Always-Allow 持久授权 ★★★

**Kocoro 源**：`internal/agents/always_allow.go` + `internal/daemon/alwaysallow.go` + `agent/tools.go:DisallowsAutoApproval` + `DisallowsUnattendedAutoApproval`

**pi 现状**：无持久授权。

**移植**：`packages/coding-agent/src/core/permissions/alwaysallow.ts`。per-agent + global 两层（借鉴 `internal/agents/always_allow.go`）。高风险付费/公开工具（云端图像生成、Cloud委托）拒绝持久化（`DisallowsAutoApproval`）。无人值守模式加一层被拒绝（`DisallowsUnattendedAutoApproval`）。

**单测**：accept-always→下次直过；高风险工具被拒；unattended 模式被拒。

---

#### K1-03 ValidationError + `[validation error]` 前缀 ★★★

**Kocoro 源**：`internal/agent/tools.go:ValidationError` —— returns `ToolResult{Content: "[validation error] " + msg, IsError: true, ErrorCategory: ErrCategoryValidation}`

**pi 现状**：ToolResult 只有 `isError: bool`，无分类，无前缀标记。

**移植**：在 `ToolResult` 加 `errorCategory: 'transient' | 'validation' | 'business' | 'permission'`。`ValidationError(msg)` 返回 `[validation error] msg` + `errorCategory='validation'`。**Kocoro 为什么必须有这个**：2026-05-13 `file_write` 无 content → 写到 0 字节 → `IsError=false` → truncate 用户文件 → 16 call 重试 stuck。`[validation error]` 前缀是 loop 检测器识别"缺字段/缺参数是可以立即停下来的 bug"的信号。

**单测**：ValidationError 内容前缀为 `[validation error]`；3 次 validation error 短路逻辑。

---

#### K1-04 ErrorCategory 四类 ★★★

**Kocoro 源**：`internal/agent/tools.go`——`transient`·`validation`·`business`·`permission`

**pi 现状**：ToolResult 无 category。

**移植**：加到 `ToolResult`。与 K1-03 联动：LoopDetector 看到 transient 给 2x retry，validation 给 3x tight cap。

---

#### K1-05 ApprovalDescription（人话描述） ★★★

**Kocoro 源**：`internal/agent/approval_description.go:DescriptionFieldSpec`——所有审批工具必须有 `description` 字段（json schema 声明 + Required 列表）。模型必须填 5-15 词自然语言意图总结。

**pi 现状**：审批面板显示原始 args（`{"path":"/Users/.../file.md"}`）。

**移植**：`packages/coding-agent/src/core/tools/description.ts`。所有 `requireApproval: true` 的 ToolDefinition 强制加 `description` string 字段。bash 除外（有 bespoke schema）。

**单测**：drift test——所有审批工具声明 description；缺失则 build 失败。

---

#### K1-06 IsConcurrencySafeCall 接口 ★★

**Kocoro 源**：`internal/agent/concurrency_safe.go`——`ConcurrencySafeChecker` 接口 + `tools/bash_concurrency.go`——Bash 静态分析白名单

**pi 现状**：dispatcher 用 `IsReadOnly` 做批处理依据。

**移植**：`packages/coding-agent/src/core/tools/concurrency.ts`。新 `ConcurrencySafeChecker` 接口：`IsConcurrencySafeCall(argsStr: string): boolean`。dispatcher 改用此接口。**回退**：未实现该接口的 tool 默认走 `IsReadOnly`。Bash 白名单：`ls`/`cat`/`head`/`tail`/`wc`/`grep`/`find`/`echo`/`date`/`pwd`/`which`（仅当 args 无 metachar、无换行）。

**单测**：Bash `ls -la` 并发；`git push` 串行；任何带 `|`/`&&`/`>` 的命令串行。

---

#### K1-07 图像三层保护 ★★

**Kocoro 源**：3 层：(1) `internal/tools/imaging_compress.go`（source-time 压缩）；(2) `internal/agent/oversize_image.go:sanitizeToolResultImages`（wire-time 脱敏 EXIF/路径）；(3) `enforcePerImageDimensionCap` + `enforceAggregateImageCap`（persist-time 维度+计数封顶）

**pi 现状**：`utils/image-resize.ts`（仅 resize），无 EXIF/路径脱敏，无 aggregate 封顶。

**移植**：`packages/coding-agent/src/core/tools/image-protection.ts`。(1) 继承 pi 现有 resize；(2) 加 EXIF 剥离；(3) 加 per-image 维度 cap + 总数 cap。

**单测**：超 10MB 图进前被压缩；EXIF 路径消失；6 images 后 aggregate cap 用 placeholder。

---

#### K1-08 工具结果三层预算 ★★★

**Kocoro 源**：3 层：(1) `internal/agent/spill.go:spillToDisk`（单结果超阈值落盘+preview）；(2) `applyAggregateCap`（per-turn 累积溢出 → 选最大 spill）；(3) `internal/agent/toolresult_budget.go:NewToolResultReplacementState`（persisted replacement map 跨 turn + crash recovery 持久）

**pi 现状**：无。

**移植**：`packages/coding-agent/src/core/tools/budget.ts`。(1) per-result spill（阈值可配）；(2) per-turn aggregate（按大小排序，spill 最大的几个回落到总 budget 内）；(3) replacement map 跨 checkpoint 持久。

**关键不变量**：crash recovery 后 replacement map 仍存在（Kocoro 文档"Persisted replacement/seen maps survive turns, final saves, and crash recovery"）。

**单测**：单结果溢出→落盘；aggregate 选最大；跨 turn 命中；crash→重启→map 仍生效。

---

#### K1-09 LoopDetect 完整化 ★★★

**Kocoro 源**：`internal/agent/loopdetect.go`（207 行）——`LoopDetector` + `ConsecutiveDup` / `ExactDup` / 2x errors / 3x validation errors / `use_skill` exempt / GUI 工具白名单 / recovered tail

**pi 现状**：`loopdetect.ts` 可能不存在（搜索无结果）。

**移植**：`packages/coding-agent/src/core/loopdetect.ts`（全新）。移植全部算法：(a) `isGUIToolName`（browser_* / computer_* 例外）；(b) `isRepeatableToolName`（navigate→snapshot→click→type 链白名单）；(c) `use_skill` 全局 exempt；(d) `latestRecoveredAfterSameArgsErrors`（tail-success 跳双检）；(e) 2x total errors→7 calls；(f) 3x validation→3 calls。

**单测**：各规则独立单测 + drift test vs Kocoro `loopdetect_test.go` fixture。

---

#### K1-10 ReadTracker（file_read 跨 Run dedup） ★

**Kocoro 源**：`internal/agent/readtracker.go` + `loop.go:readTracker`——per-loop reset / session-level 持久（同一 file+range 不重复读）

**pi 现状**：无。

**移植**：`packages/coding-agent/src/core/tools/readtracker.ts`。key = `path:offset:limit`，跨 turn 持久。

**单测**：同 file+range 再次命中；文件变更后 miss；checkpoint restore 不破坏 tracker。

---

### K2：认证与生态（进阶，8–10 周）

#### K2-01 macOS Keychain 集成 ★★★

**Kocoro 源**：`internal/keychain/`（5 文件）——`Backend` 接口 + `osBackend`（darwin via `zalando/go-keyring`）+ `backend_other.go`（返回 `ErrUnsupportedPlatform`）+ `backend_mem.go`（测试用）

**pi 现状**：`auth-storage.ts` 只有 `FileAuthStorageBackend`（写 `auth.json`）+ `InMemoryAuthStorageBackend`。

**移植**：`packages/coding-agent/src/core/auth/keychain.ts`。实现 `KeychainBackend` 接口（`read`/`write`/`delete`）。Darwin 走 macOS `security` 命令；Linux/win 回退 `FileAuthStorageBackend`。**关键不变量**：api_key 字节绝不进 audit log（Kocoro 同款约束）。

**单测**：darwin round-trip；other 平台 stub；key 字节不在测试输出。

---

#### K2-02 Auth 状态机 ★★

**Kocoro 源**：`internal/daemon/auth.go:AuthManager`——5 态（signed_out → pending_verification → logging_in → bootstrapping_key → signed_in）+ `auth_state_changed` 事件

**pi 现状**：OAuth callback + `auth-storage.ts` 无状态机。

**移植**：`packages/coding-agent/src/core/auth/state.ts`。5 态 + `auth_state_changed` 事件走 `EventBus`。WS 连接仅 `signed_in` 态驱动。

**单测**：合法迁移成功；非法迁移拒绝；事件正确发。

---

#### K2-03 Skill 市场 ★★

**Kocoro 源**：`internal/skills/marketplace.go`（`MarketplaceClient` + TTL + stale-on-error + `SecurityScan`）

**pi 现状**：`skills.ts` 只有 `loadSkillsFromDir` + `formatSkillsForPrompt`。

**移植**：`packages/coding-agent/src/core/skills/marketplace.ts` + pi-web `app/api/skills/marketplace/*`。`GET /marketplace` + `GET /marketplace/entry/[slug]` + `POST /marketplace/install/[slug]`。**关键不变量**：TTL + stale-on-error。

**单测**：TTL 命中本地；过期走网络；网络失败仍能用 stale。

---

#### K2-04 Skill 密钥系统 ★

**Kocoro 源**：`internal/skills/secrets.go`——`SecretsStore`（per-skill + env injection + Keychain backed）+ `IsValidEnvKey`

**pi 现状**：无。

**移植**：`packages/coding-agent/src/core/skills/secrets.ts`。skill load 时注入 env；exec 后清空。Keychain 后端（若 K2-01 已做）或文件后备。

**单测**：注入/清空 cycle；非法 key 拒绝；env 隔离。

---

#### K2-05 Skill provenance / 安全扫描 ★

**Kocoro 源**：`internal/skills/provenance.go` + `validate.go`——marketplace 安装写 `{slug, sha, source}` 证明链 / 2 重安全扫描（`SecurityScan.IsMalicious`）

**pi 现状**：无。

**移植**：`packages/coding-agent/src/core/skills/provenance.ts`。marketplace 安装后写 `.kocoro-provenance.json`。

---

#### K2-06 Skill allowed-tools 执行期强制 ★

**Kocoro 源**：`internal/tools/skill.go:IsSkillExempt` + `skill_exempt_test.go`——执行期拒（不是 schema 过滤），保 prompt cache 稳定

**pi 现状**：无执行期强制。

**移植**：`packages/coding-agent/src/core/skills/allowed-tools.ts`。在 `executeTools` 之前检查 skill `allowedTools`；不匹配 → `PermissionError`。**关键不变量**：schema 不裁剪（prompt cache 稳定）。

**单测**：schema 仍然声明拦截 tool；执行期拒；prompt 不变。

---

#### K2-07 desktopOnlySkills 过滤器 ★

**Kocoro 源**：`internal/daemon/skill_filter.go` + `skill_filter_test.go`（cross product drift test）

**pi 现状**：无。

**移植**：`packages/coding-agent/src/core/skills/filter.ts`。桌面专用 skill 在 api/webhook 请求中不暴露。Drift test：映射表 × source set 全交叉。

---

#### K2-08 Claude Code 迁移 ★★

**Kocoro 源**：`internal/migrate/claudecode/`（21 文件）——5 converter（agent/command/mcp/rules/skill）+ `plan_store` + 隐私脱敏 + preview/apply

**pi 现状**：无。

**移植**：`packages/coding-agent/src/migrate/claude-code/{planner,converter_*,applier,plan_store}.ts` + pi-web preview 页面。**关键不变量**：原始 `~/.claude/` 不破坏；preview 阶段全部在 plan_store。

**单测**：5 种 converter 样例；隐私脱敏；preview→apply 不破坏源头。

---

#### K2-09 Session Sync（opt-in） ★★

**Kocoro 源**：`internal/sync/`（6 文件）——opt-in + flock + marker + batcher + uploader + `strip_thinking.go`（上传前剥离 thinking block）

**pi 现状**：pi-web `session-share.ts` 是单次 share。

**移植**：`packages/coding-agent/src/core/session/sync.ts`。opt-in 旗标；flock 防并发；thinking block 上传前剥离；失败条目录持久。

**单测**：flock 并发互斥；thinking 剥离；重启后目录仍在。

---

#### K2-10 审计 ★

**Kocoro 源**：`internal/audit/audit.go:RedactSecrets`——API key / Bearer / `auth.json` 路径 mask

**pi 现状**：无。

**移植**：`packages/coding-agent/src/core/audit/`。正则 mask + 路径截断。

**单测**：`sk-...` / `Bearer ...` / `/Users/.../auth.json` mask。

---

### K3：战略（多通道 + Mac 工作台 + 多智能体，10–14 周）

#### K3-01 多通道 IM 输入 ★★

**Kocoro 源**：7 个 handler + `im_bindings.go` + `channel_state_*.go`——Feishu·Lark·WeCom·Slack·LINE·Telegram·Webhook

**pi 现状**：CLI/Web 仅本地。

**移植**：`packages/coding-agent/src/core/channels/`（7 个 handler 各 1 文件 + router）。每个通道 `parse → enqueue → format reply`。

#### K3-02 Channel 路由 ★

**Kocoro 源**：`internal/daemon/runner.go` 5 段路由——explicit session → threaded → per-sender → agent → legacy channel

**移植**：`packages/coding-agent/src/core/channels/router.ts`。

#### K3-03 Capability Token ★

**Kocoro 源**：`internal/daemon/ws_controller.go`——WS 握手 `tool_use_id_events` / `schedule_broadcast_gate` / `proactive_thread_mode`

**移植**：`packages/coding-agent/src/core/ws/handshake.ts`。每个新可选特性带 token。

#### K3-04 macOS GUI 工具 ★★

**Kocoro 源**：`internal/tools/calendar_*`（8 文件，calendar CRUD + request/list permission + sources）+ `computer.go` + `applescript.go` + `clipboard.go` + `ghostty_darwin.go`

**pi 现状**：无。pi 走 TUI 自动化，没有 macOS GUI 工具。

**移植**：`packages/coding-agent/src/core/tools/` 加这些工具。darwin-only；other 平台 stub。

#### K3-05 文档提取 ★

**Kocoro 源**：`internal/tools/doc_extract.go`——PDF / Word / Excel / 二进制回退

**移植**：`packages/coding-agent/src/core/tools/doc-extract.ts`。

#### K3-06 图像生成 / 编辑 ★

**Kocoro 源**：`internal/tools/generate_image.go` + `edit_image.go`（独立 tool，完整描述 + 审批）

**移植**：`packages/coding-agent/src/core/tools/{generate,edit}-image.ts`。需走 K1-07 三层保护。

#### K3-07 Schedule 主动推送 ★★

**Kocoro 源**：`internal/schedule/schedule.go`——auto/on/off 三态 + `broadcast_gate.go`（broadcast 控制是否推送到 IM）+ thread anchoring

**移植**：`packages/coding-agent/src/core/schedule/`。

#### K3-08 Desktop RPC 反向通道 ★

**Kocoro 源**：`internal/daemon/desktop_rpc/`（5 文件）——Unix sock + length-prefix JSON codec + DesktopRPCBroker

**移植**：`packages/coding-agent/src/core/desktop-rpc/`。pi 引擎与 pi-web/macOS App 的解耦通道。

#### K3-09 浏览器自动化 ★

**Kocoro 源**：`internal/tools/browser.go` + `browser_lease.go`——Chrome 租约 + profile 隔离 + session 边界

**移植**：`packages/coding-agent/src/core/tools/browser-lease.ts`。

#### K3-10 多智能体 ★★

**Kocoro 源**：`internal/agents/`（15+ 文件）——per-agent 配置（commands/skills/always-allow/usage）独立 + validate + warnings + builtin

**pi 现状**：单 agent。

**移植**：`packages/coding-agent/src/core/agents/`。per-agent IAM + 用量独立统计。

#### K3-11 提示建议（cache-safe） ★

**Kocoro 源**：`internal/agent/suggestion.go`——forked request after success + byte-equality 不变量

**pi 现状**：无。

**移植**：`packages/coding-agent/src/core/agent/suggestion.ts`。fork 与 main byte-equal except 4 项例外。

#### K3-12 记忆 sidecar ★★

**Kocoro 源**：`internal/memory/`（18 文件）——sidecar lifecycle（Spawn/WaitReady/Shutdown）+ bundle puller + tenant safety + audit + preflight（in-message only, audit-counts 不传原文）

**pi 现状**：`MEMORY.md` 本地简单读。

**移植**：`packages/coding-agent/src/core/memory/`。完整生命周期 + preflight 不持久 + audit 指纹制。

#### K3-13 Hook 系统 ★

**Kocoro 源**：`internal/hooks/hooks.go`——PreToolUse / PostToolUse / SessionStart / Stop 4 触发点

**移植**：`packages/coding-agent/src/core/hooks/`。best-effort（不因 hook 失败而 tool 失败）。

#### K3-14 SQLite FTS 会话索引 ★

**Kocoro 源**：`internal/session/index.go`——trigram 模糊搜索 + UpsertSession + NeedsRebuild

**移植**：`packages/coding-agent/src/core/session/index.ts`。

---

## 3. 明确不做

| 项 | 原因 |
|----|------|
| Kocoro 的 Cloud WebSocket 长连接 | pi 的 Cloud 集成是不同的产品路径（exe.dev ≠ Kocoro Cloud） |
| Kocoro 的 Desktop Swift 实现 | pi-web 用 WKWebView 即可 |
| `cache_source`·`cache_idempotence`（K1-13 去除了） | pi 自带 `CompactionSettings`·`SettingsManager`，不冲突 |
| Phase machine + Watchdog（K1-12 去除了） | pi 有 `compact`·`findCutPoint`·timeout，不搬 Go 版状态机 |
| State cache + browser state ref | pi 的 compact 上下文管理已够；不搬 `statecache.go` |

---

## 4. 分阶段统计

| 阶段 | 项数 | 核心价值 | 工期 |
|------|------|---------|------|
| **K1** | 10 | 防 stuck loop、防权限漏洞、防大上下文爆炸、防并发 bug | 8–10 周 |
| **K2** | 9 | Keychain、Auth 机、市场、密钥、迁移、同步、审计 | 8–10 周 |
| **K3** | 14 | 多通道入口、Mac 工作台、多智能体、记忆、Hook | 10–14 周 |

---

## 5. K1 立即可开工（按 ROI）

1. **K1-03+K1-04**（ValidationError + ErrorCategory）——`ToolResult` 加字段 + LoopDetector 加规则 · 最小改动防最大事故 · drift test 用 Kocoro `loopdetect_test.go` fixture
2. **K1-05**（ApprovalDescription）——全部审批工具强制加 `description` 字段
3. **K1-09**（LoopDetect 完整化）——补全规则矩阵
4. **K1-06**（IsConcurrencySafeCall）——dispatcher 升级 · Bash 静态分析
5. **K1-08**（Tool result 三层预算）——最值得做 · pi 引擎最薄弱环境
6. **K1-01+K1-02**（权限 + Always-Allow）——体积最大但有全套 Kocoro 算法可搬
7. **K1-07**（图像三层）
8. **K1-10**（ReadTracker）

---

## 6. 吸收原则

1. **算法照搬 Kocoro，TS 重写**——不调 Go 二进制
2. **不改 pi 核心契约**——`AgentSession`·`ToolDefinition`·RPC 不动
3. **ExtensionAPI 先行**——新能力先以 extension 注入，验证后合主线
4. **灰度 flag**——K1 默认 off，`experimental.permissions`… 用户手动开
5. **Drift test**——每项 K1/K2 必须正反方对照（Kocoro Go fixture vs pi TS 同数据）
6. **每项可回滚**——不做 `_enhanced` 变体

---

## 7. 关键文件地图

| Kocoro（源） | pi 落点 | 阶段 |
|-------------|---------|------|
| `permissions/permissions.go` | `core/permissions/permissions.ts` | K1 |
| `agent/tools.go:ValidationError` | `core/tools/result.ts` | K1 |
| `agent/loopdetect.go` | `core/loopdetect.ts` | K1 |
| `agent/approval_description.go` | `core/tools/description.ts` | K1 |
| `agent/concurrency_safe.go` | `core/tools/concurrency.ts` | K1 |
| `tools/imaging_compress.go` + `agent/oversize_image.go` | `core/tools/image-protection.ts` | K1 |
| `agent/spill.go` + `agent/toolresult_budget.go` | `core/tools/budget.ts` | K1 |
| `agent/readtracker.go` | `core/tools/readtracker.ts` | K1 |
| `agents/always_allow.go` | `core/permissions/alwaysallow.ts` | K1 |
| `keychain/`（5 文件） | `core/auth/keychain.ts` | K2 |
| `daemon/auth.go` | `core/auth/state.ts` | K2 |
| `skills/marketplace.go` | `core/skills/marketplace.ts` | K2 |
| `skills/secrets.go` | `core/skills/secrets.ts` | K2 |
| `skills/provenance.go` | `core/skills/provenance.ts` | K2 |
| `skills/validate.go` | `core/skills/validate.ts` | K2 |
| `tools/skill.go` | `core/skills/allowed-tools.ts` | K2 |
| `daemon/skill_filter.go` | `core/skills/filter.ts` | K2 |
| `migrate/claudecode/`（21 文件） | `migrate/claude-code/` | K2 |
| `sync/`（6 文件） | `core/session/sync.ts` | K2 |
| `audit/audit.go` | `core/audit/redact.ts` | K2 |
| 7 通道 handler | `core/channels/`（7 文件） | K3 |
| `daemon/runner.go`（routing） | `core/channels/router.ts` | K3 |
| `tools/calendar_*`（8 文件） | `core/tools/calendar-*.ts` | K3 |
| `tools/{computer,applescript,clipboard}.go` | `core/tools/{computer,applescript,clipboard}.ts` | K3 |
| `tools/doc_extract.go` | `core/tools/doc-extract.ts` | K3 |
| `tools/{generate_image,edit_image}.go` | `core/tools/{generate,edit}-image.ts` | K3 |
| `schedule/schedule.go` + `broadcast_gate.go` | `core/schedule/` | K3 |
| `daemon/desktop_rpc/`（5 文件） | `core/desktop-rpc/` | K3 |
| `tools/browser.go` + `browser_lease.go` | `core/tools/browser-lease.ts` | K3 |
| `agents/`（15+ 文件） | `core/agents/` | K3 |
| `agent/suggestion.go` | `core/agent/suggestion.ts` | K3 |
| `memory/`（18 文件） | `core/memory/` | K3 |
| `hooks/hooks.go` | `core/hooks/` | K3 |
| `session/index.go` | `core/session/index.ts` | K3 |

---

## 8. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-08 | v8 终版——完整逐项对照 Kocoro 与 pi 代码现状（`agent-session.ts`·`compaction/`·`auth-storage.ts`·`skills.ts`·`branch-tree.ts`）。去除 pi 已有的所有项。保留 pi 真正缺的 30 项分 K1/K2/K3 + 每项一份 Kocoro 源文件 + pi 落点 + 单测门槛 + drift test 要求。 |
