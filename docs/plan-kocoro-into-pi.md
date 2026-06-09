# Kocoro → pi 吸收计划

**版本**：2026-06-08  
**方向**：Kocoro（Go daemon + 多通道智能体）的成熟能力 → pi/pi-web（Next.js Web 工作台 + pi-coding-agent 运行时）  
**前置**：[AGENTS.md](../AGENTS.md) · [pi 总览](https://github.com/earendil-works/pi-mono) · [pi-web 总计划](https://github.com/earendil-works/pi-web/blob/main/docs/plan-pi-web-macos-workbench.md)

> 前一版写反了（`plan-pi-web-absorption.md`），已删除。本文档是正确方向：**pi 吸收 Kocoro**。

---

## 0. 摘要

pi 与 Kocoro 形态互补：

| 维度 | pi / pi-web | Kocoro |
|------|-------------|--------|
| 形态 | Next.js Web + pi-coding-agent TS 运行时 + macOS App（薄壳 + WKWebView） | Go daemon + Cloud WS + 7 个 IM 通道 + Shannon Desktop |
| 主战场 | 本地浏览器 + 终端 CLI/TUI | IM 通道 + Desktop + TUI |
| 优势 | 运行时/分支树/场景/Web Push/E2EE Relay | 生产硬化（权限/校验/并发/图像/记忆）+ 多通道 + 生态（市场/同步/迁移/多智能体） |
| 引擎 | `@earendil-works/pi-coding-agent`（0.78.2）+ `pi-agent-core` | `internal/agent` 自研 Go 循环 |

**核心动机**：把 Kocoro 三年在「多通道、权限安全、企业化」沉淀下来的能力补到 pi 引擎里，让 pi 既能当 Web/CLI 工作台，也能从 IM/Cloud/Keychain 进来。下面 30 项分三阶段实施（K1/K2/K3）。

---

## 1. 现状基线

### 1.1 pi / pi-web 已有（不可重复造轮子）

**pi-coding-agent（`packages/coding-agent`）核心 API（dist/index.d.ts 已读）**：
- `AgentSession` + `EventBus` + `createEventBus` · `CompactionResult` · `BranchSummaryResult` · `CompactionSettings` · `RetrySettings` · `ImageSettings` · `SettingsManager`
- `SessionManager` · `buildSessionContext` · `migrateSessionEntries` · `getLatestCompactionEntry`
- `defineTool` · `ToolDefinition` · `ToolRenderResultOptions` · `RegisteredTool`
- `createReadTool` / `createWriteTool` / `createEditTool` / `createBashTool` / `createReadOnlyTools`
- `AuthStorage` + `FileAuthStorageBackend` + `InMemoryAuthStorageBackend`（`core/auth-storage.ts`）
- `Compaction`、`findCutPoint`、`generateBranchSummary`（**已有**分支摘要！Kocoro 没有这条线）
- `getCommands` / `slash-commands.ts` / `prompt-templates.ts`
- `ProjectTrustStore`（`trust-manager.ts`）

**pi-web 已有**（已读 `lib/` 93 个文件）：
- `branch-tree.ts`（**视觉化分支树**，Kocoro 没有）
- `branch-navigate-error.ts`（**分支切换错误归因**）
- `fork_session` / `clone_session` RPC（M1 里程碑已落地）
- `navigate_tree` RPC
- `scenes.ts` / `scene-overrides.ts` / `scene-pack.ts`（**场景 JSON 包导入导出**）
- `remote-auth.ts` / `pi-relay/*`（**X25519 + AES-GCM E2EE relay**）
- `push-notifications.ts` / `service-worker-client.ts`（**Web Push**）
- `share/` · `sanitize-export-html.ts`（**导出 HTML**）
- `i18n/`（**zh-CN/en**）
- `tool-presets.ts`（**简洁/标准/高级三档**）
- `web-fetch` 三档（JSON-LD / Readability / WKWebView）

### 1.2 Kocoro 可供吸收的清单（pi 完全 / 部分缺失）

> 「可吸收」意味着：(1) Kocoro 已有可用代码 + 单测，(2) 移植到 pi 是单栈工作（TS 重写或包 import），(3) 引入后不破坏 pi 现有契约（`AgentSession`、`ToolDefinition`、RPC 协议）。

| 类别 | 编号 | 能力 | Kocoro 落点（已读） | pi 现状 | 阶段 |
|------|------|------|---------------------|---------|------|
| **生产硬化** | K1-01 | 工具权限系统（hard-block → denied → always-ask → allowed → default safe → ask） | `internal/permissions/permissions.go`（`hardBlockPatterns` + `alwaysAskPrefixes` + `AlwaysAllowTools`） | **完全缺失**（pi AGENTS.md 明确说"no built-in permission system"） | K1 |
| | K1-02 | Always-allow 持久授权 + 高风险付费/公开工具拒绝持久化 | `internal/agents/always_allow.go` + `internal/daemon/alwaysallow.go` + `agent.DisallowsAutoApproval` | **缺失** | K1 |
| | K1-03 | `ValidationError` + `[validation error]` 前缀 + LoopDetector 短路 | `internal/agent/tools.go:ValidationError` + `internal/agent/loopdetect.go:isValidationErrorSig` | **缺失**（pi 的 stuck loop 无防御） | K1 |
| | K1-04 | `ErrorCategory` 四类分类（transient/validation/business/permission） | `internal/agent/tools.go` | pi 用 `IsError: bool`，无分类 | K1 |
| | K1-05 | `ApprovalDescription` — 工具必须自带人话描述（强制 `description` 字段） | `internal/agent/approval_description.go:DescriptionFieldSpec` | **缺失**（pi 批准面板显示原始 args） | K1 |
| | K1-06 | 工具并发安全 — `IsConcurrencySafeCall` 显式接口 | `internal/agent/concurrency_safe.go` + `tools/bash_concurrency.go` | **缺失**（pi 用 `IsReadOnly` 兼任批处理依据） | K1 |
| | K1-07 | 图像三层保护（source compression / wire sanitization / persist guard） | `internal/tools/imaging_compress.go` + `internal/agent/oversize_image.go` + `internal/images/` | **部分**（`utils/image-resize.ts` 有） | K1 |
| | K1-08 | 工具结果三层预算（per-result spill / per-turn aggregate / persisted replacement） | `internal/agent/spill.go` + `internal/agent/toolresult_budget.go` + `tools/oversize_image.go` | **缺失**（Kocoro AGENTS 明确这是必备；pi 没有同等机制） | K1 |
| | K1-09 | Loop 检测（ConsecutiveDup / ExactDup / 2x 错误 / 3x 校验 / `use_skill` 例外） | `internal/agent/loopdetect.go`（`LoopDetector` + `isGUIToolName` + `isRepeatableToolName`） | **部分**（pi `loopdetect.ts` 存在但远不如 Kocoro 全面） | K1 |
| | K1-10 | Read-before-edit tracker（file_read dedup 跨 Run 持久） | `internal/agent/readtracker.go` + `loop.go:readTracker` | **缺失** | K1 |
| | K1-11 | State cache + state version（filesystem / browser 域 fingerprint） | `internal/agent/statecache.go` | **缺失** | K2 |
| | K1-12 | Phase 机器 + Watchdog（LLM-wait / force-stop 算 idle） | `internal/agent/phase.go:TurnPhase` + `internal/agent/watchdog.go` | **缺失**（pi 也有 watchdog 但粒度粗） | K2 |
| | K1-13 | Cache idem-potence / `cache_source` 传播（Cloud-side billing 同步） | `internal/agent/cachemetric.go` + `cache_idempotence_test.go` + `cachemetric_test.go` | **缺失** | K2 |
| | K1-14 | Context 窗口自适应 + 主动/反应压缩分闸 | `internal/agent/modelmaxtokens.go` + `microcompact.go` + `timebasedcompact.go` | **部分**（pi 有 compaction 但 Kocoro 的三层更细） | K2 |
| **认证 / 凭据** | K2-01 | macOS Keychain 集成（darwin/other 双 backend + ErrUnsupportedPlatform） | `internal/keychain/{keychain.go,backend_darwin.go,backend_other.go,backend_mem.go}` | **缺失**（pi 用 `auth.json` 文件） | K2 |
| | K2-02 | Auth 状态机（signed_out → pending_verification → logging_in → bootstrapping_key → signed_in） | `internal/daemon/auth.go:AuthManager` + `auth_handlers.go` | **缺失**（pi 只有 OAuth callback + file storage） | K2 |
| | K2-03 | 工具 `DisallowsUnattendedAutoApproval`（高风险付费工具无人值守拦截） | `internal/agent/tools.go:DisallowsUnattendedAutoApproval` | **缺失** | K1 |
| **通道 / 分布** | K2-04 | 多通道 IM 输入（Feishu / Lark / WeCom / Slack / LINE / Telegram / Webhook） | `internal/daemon/{feishu_handler.go,im_bindings.go,channel_state_*.go}` | **缺失**（pi 是 CLI/Web） | K3 |
| | K2-05 | Channel 路由（explicit session → threaded → per-sender → agent → legacy channel） | `internal/daemon/runner.go` + `e2e_routing_test.go` | **缺失** | K3 |
| | K2-06 | Capability token（WS 握手 `tool_use_id_events` / `schedule_broadcast_gate` / `proactive_thread_mode`） | `internal/daemon/ws_controller.go` + `client_caps_test.go` | **缺失** | K3 |
| | K2-07 | Cloud 委托（长任务上 Cloud） | `internal/tools/cloud_delegate.go` | **缺失** | K3 |
| **生态** | K2-08 | Skill 市场（search / install / 评分 / security scan / provenance 链） | `internal/skills/marketplace.go`（含 `SecurityScan`、`MarketplaceClient`、TTL stale-on-error） | **缺失**（pi `skills.ts` 较薄） | K2 |
| | K2-09 | Skill 密钥管理（`SecretsStore` + Keychain 后端 + 配置校验） | `internal/skills/secrets.go`（`keychainServiceName` + `IsValidEnvKey`） | **缺失** | K2 |
| | K2-10 | Skill provenance / 安全扫描 / 资产-脚本-引用-密钥四件套 | `internal/skills/{provenance.go,validate.go}` + `bundled/skills/` | **部分**（pi 有 `formatSkillsForPrompt`） | K2 |
| | K2-11 | Skill `allowed-tools` 执行期强制（不通过 schema 过滤，保 cache 稳定） | `internal/tools/skill.go` + `agent.IsSkillExempt` + `skill_exempt_test.go` | **缺失** | K2 |
| | K2-12 | Skill `desktopOnlySkills` 过滤器（云通道不暴露桌面专用） | `internal/daemon/skill_filter.go` + `skill_filter_test.go`（drift cross product） | **缺失** | K2 |
| | K2-13 | Claude Code 迁移（agent / command / mcp / rule / skill 五个 converter + plan_store + 隐私脱敏） | `internal/migrate/claudecode/`（21 个文件，preview/apply endpoint 已挂） | **缺失**（用户获取渠道） | K2 |
| | K2-14 | 会话同步（opt-in + flock + 标记 + 重传 + 失败簿记 + 思考块剥离） | `internal/sync/{sync.go,batcher.go,marker.go,scanner.go,strip_thinking.go}` | **部分**（pi-web `session-share.ts` 是单次 share，不是持续 sync） | K2 |
| | K2-15 | 审计（内容脱敏 + 路径截断 + secret 替换） | `internal/audit/audit.go:RedactSecrets` + `internal/daemon/audit/` | **缺失** | K2 |
| | K2-16 | Hook 钩子（PreToolUse / PostToolUse / SessionStart / Stop） | `internal/hooks/hooks.go`（`HookRunner` + 4 个 Run* 方法） | **缺失**（pi extensions 是另一套） | K3 |
| | K2-17 | SQLite FTS 会话索引（`trigram`/`splitQueryTerms` 模糊搜索） | `internal/session/index.go`（`OpenIndex` + `Search` + `UpsertSession`） | **缺失**（pi `SessionManager` 走文件） | K3 |
| **Mac 工作台** | K3-01 | macOS GUI 工具（calendar / computer / applescript / ghostty / clipboard） | `internal/tools/{calendar_*,computer.go,applescript.go,ghostty_darwin.go,clipboard.go}` | **缺失**（pi 走 TUI 自动化） | K3 |
| | K3-02 | 文档提取（PDF / Word / Excel） | `internal/tools/doc_extract.go` | **缺失** | K3 |
| | K3-03 | 图像生成 / 编辑（独立工具，Cloud 或本地） | `internal/tools/{generate_image.go,edit_image.go}` + `imaging_compress.go` | **缺失**（pi 走 extension） | K3 |
| | K3-04 | Desktop RPC 反向通道（Unix sock + length-prefix codec + DesktopRPCBroker） | `internal/daemon/desktop_rpc/{listener.go,codec.go,broker.go,types.go}` | **缺失**（pi-web 是 Web 不需要；可作为 pi 引擎 + 桌面壳的通用解） | K3 |
| | K3-05 | Schedule 主动推送（auto/on/off 三态 + broadcast + thread anchoring） | `internal/schedule/` + `internal/daemon/broadcast_gate.go` | **缺失** | K3 |
| | K3-06 | 浏览器自动化（Chrome 租赁 / 隔离 profile / pinchtab） | `internal/tools/{browser.go,browser_lease.go,browser_handoff.go,pinchtab.go}` | **部分**（pi 没有完整 Chrome 租赁） | K3 |
| **Agent 架构** | K3-07 | 多智能体 + per-agent 配置（命令 / 技能 / always-allow 各自独立） | `internal/agents/{api.go,loader.go,always_allow.go,usage.go,validate.go,warnings.go,builtin,embed.go}` | **缺失**（pi 单 agent） | K3 |
| | K3-08 | 提示建议（forked request 缓存安全不变量） | `internal/agent/suggestion.go` + `suggestion_state.go`（带 byte-equality 保证） | **缺失** | K3 |
| | K3-09 | 记忆 sidecar 客户端/监督/拉取/审计/租户安全 | `internal/memory/{client.go,sidecar.go,service.go,bundle.go,audit.go,tenant.go,attached_querier.go,querybatch.go,errclass.go}` | **缺失**（pi `MEMORY.md` 本地简单读） | K3 |
| | K3-10 | 记忆 preflight（in-message 私记注入 + 审计仅记指纹） | `internal/agent/preflight.go` + `internal/tools/memory_preflight.go` | **缺失** | K3 |

---

## 2. 吸收原则

1. **不破坏 pi 现有契约** — `AgentSession`、`ToolDefinition`、RPC 协议保持兼容；新能力以 `ExtensionAPI`（`ExtensionActions`）形式注入，**不**改核心 types。
2. **优先用 Kocoro 的算法/不变量，TS 重写** — 核心算法（LoopDetector 阈值、ValidationError 短路、ConcurrencySafe 静态分析、tool budget 三层）在 Kocoro 已用 200+ 单测跑过；直接搬算法而不是搬代码。
3. **不复制 Go 运行时** — Kocoro 是 daemon；pi 是 CLI/Web。共性是**抽象**（权限/校验/并发/图像/上下文/记忆），具体实现各自走语言原生路径。
4. **三阶段、按 ROI** — K1 = 必修（生产硬化，缺这些 pi 的生产事故会持续）。K2 = 进阶（认证 + 生态）。K3 = 战略（多通道 + 多智能体 + Mac 工作台）。
5. **每项可回滚** — pi-coding-agent 的 RPC 命令集**不**直接扩；新功能先以 `ExtensionAPI` 暴露，验证后再合主线。
6. **不引入 Go 依赖** — 写 TS，不调 Kocoro 二进制。如果 Kocoro 的某个能力本质是 Cloud 侧的（如市场搜索），pi 端只做客户端。

---

## 3. 分阶段实施计划（K1/K2/K3）

### K1：生产硬化（必修，~8–10 周）

**目标**：让 pi 在多用户生产环境下不出事故。

| 任务 | pi 落点 | 关键改动（Kocoro 算法 → pi 实现） | 验收 |
|------|---------|--------------------------------------|------|
| **K1-01 权限系统** | `packages/coding-agent/src/core/permissions/{permissions,hardblock,alwaysask}.ts`（新） | 移植 Kocoro 5 段解析：`hardBlockPatterns` → `denied_commands` → `alwaysAskPrefixes` → `allowed_commands` → default safe → approval + safe checker。**与 K1-02 联动**：`AlwaysAllow` 决策持久到 `settings.json` 的 `always_allow_tools`；高风险工具（`DisallowsAutoApproval`）拒绝持久化。**关键不变量**：always-ask 永远在 allowlist 之前；hard-block 不可被 config 覆盖。 | 单测：5 段顺序矩阵；高风险前缀单测；drift test：bash 静态分析 + alwaysAskPrefixes cross product。 |
| **K1-02 Always-allow** | `packages/coding-agent/src/core/permissions/alwaysallow.ts` + RPC `set_always_allow` | 端口：Kocoro `agent/alwaysallow.go` 的「per-agent + global」两层；Web 与 TUI 共享同一存储。 | 单测：UI accept-always → 下次直接通过；高风险工具被拒绝持久化。 |
| **K1-03 + K1-04 ValidationError + ErrorCategory** | `packages/coding-agent/src/core/tools/result.ts`（新）+ `loopdetect.ts`（扩） | 在 `ToolResult` 加 `errorCategory: 'transient' \| 'validation' \| 'business' \| 'permission'`；`ValidationError(msg)` 返回 `[validation error] 前缀` + `errorCategory='validation'`。**`loopdetect.Check` 新增规则**：3 连 `[validation error]` 同工具同 args → `LoopForceStop`，低于 2x all-errors 预算（#7）。**算法照搬**：`isValidationErrorSig` 走 `HasPrefix(sig, '[validation error]')`；`consecValidationErrCount` 独立于 `consecErrCount`。 | 单测：4 类 error 计数独立；3 连 validation 立即停；2x 错误预算不被 validation 错误提前消耗。 |
| **K1-05 ApprovalDescription** | `packages/coding-agent/src/core/tools/description.ts`（新） | 移植 Kocoro `DescriptionFieldSpec`：所有 `requireApproval: true` 的工具必须声明 `description: { type: 'string', description: '...中文/English...' }` 且 `Required` 包含 `description`。**Bash 除外**（有 bespoke schema，改了会破 cache）。 | drift test：所有 approval-required 工具声明 description 字段；缺则 build 失败。 |
| **K1-06 Tool concurrency** | `packages/coding-agent/src/core/tools/concurrency.ts`（新接口） | 新增 `ConcurrencySafeChecker` 接口（`IsConcurrencySafeCall(argsStr: string): boolean`）；dispatcher 改用此接口分组（而不是 `IsReadOnly`）。**回退语义**：未实现该接口的 tool 默认走 `IsReadOnly` 值。**Bash 静态分析照搬** Kocoro：`whitelist[cmd] && !metachar && !newline` → safe。 | 单测：Bash 工具的 `npm install` 不并发（不在白名单）；`ls -la` 并发；metachar 永远串行；fallback 路径保留旧行为。 |
| **K1-07 图像三层保护** | `packages/coding-agent/src/core/tools/image-protection.ts`（新） | 3 个 guard：(1) **source-time** 压缩（`resizeImage` + `formatDimensionNote`）→ 借鉴 Kocoro `tools/imaging_compress.go`；(2) **wire-time** 脱敏（剥离 EXIF/路径/metadata）→ 借鉴 `oversize_image.go:sanitizeToolResultImages`；(3) **persist-time** 维度封顶（per-image 维度 + aggregate 计数）→ 借鉴 `enforcePerImageDimensionCap` + `enforceAggregateImageCap`。 | 单测：超大图进前先压缩；EXIF 路径被剥；超出 aggregate cap 用 placeholder。 |
| **K1-08 Tool result 预算** | `packages/coding-agent/src/core/tools/budget.ts`（新） | 3 层预算照搬：(1) **per-result spill**（单结果超出阈值 → 落盘 + preview）；(2) **per-turn aggregate**（累积后超出 → 把最大的 spill 掉）；(3) **persisted replacement map**（替换/seen map 跨 turn + 跨 final save 持久）。**关键不变量**：crash recovery 时替换 map 也要恢复（Kocoro 的"持久化"语义）。 | 单测：单结果 spill；aggregate spill 选最大；replacement map 跨 turn 命中；crash → 重启 → map 仍生效。 |
| **K1-09 Loop detection 完整化** | `packages/coding-agent/src/core/loopdetect.ts`（扩） | 补齐 Kocoro 规则：(a) `isGUIToolName`（browser_* / computer_* 例外）；(b) `isRepeatableToolName`（navigate→snapshot→click→type→snapshot 链）白名单；(c) `use_skill` 全局 dup-exempt（纯加载器）；(d) `recovered = tail-success after any error` → 跳 1a/1b 双检。 | 单测：5 工具连发不触发；3 相同 args 触发；2x 错误 → 7 calls；3x 校验 → 3 calls。 |
| **K1-10 Read tracker** | `packages/coding-agent/src/core/tools/readtracker.ts`（新） | 移植 Kocoro `agent.ReadTracker`：per-loop（当前 turn）reset；session-level（跨 Run）持久。`file_read` 命中 → 复用。**关键**：bloat event 不重复触发；`setReadTracker` 支持外部注入（测试用）。 | 单测：同 file + 同 range 二次读命中；改文件后再读 miss；checkpoint restore 不破坏 tracker。 |
| **K1-03b DisallowsUnattendedAutoApproval** | `packages/coding-agent/src/core/tools/policy.ts`（新） | 高风险付费/公开工具（云端图像生成、Cloud 委托、外部 API）在 unattended 模式（detached / scheduled）下被拒。**端口**：Kocoro `agent/tools.go:DisallowsUnattendedAutoApproval`。 | 单测：scheduled run 调云端图像生成被拒；interactive 调成功。 |

**K1 验收**
- [ ] 5 段权限系统默认开；用户级 override 通过 settings。
- [ ] 高风险 bash 命令无法被 config 静默。
- [ ] validation 错误 3 连立即停；all-errors 预算独立。
- [ ] 工具 `description` 字段缺则 build 失败。
- [ ] Bash `ls -la` 与文件读并发跑；`git push` 串行。
- [ ] 大图进上下文前压缩；EXIF 路径消失。
- [ ] 单工具大结果落盘 + preview；累积后再次 spill。
- [ ] stuck loop 2x 错误防御 + 3x 校验防御。
- [ ] file_read 跨 Run 复用。

---

### K2：认证 + 生态（~8–10 周）

**目标**：让 pi 能进企业 / 多用户 / 跨通道场景。

| 任务 | pi 落点 | 关键改动 | 验收 |
|------|---------|----------|------|
| **K2-01 macOS Keychain** | `packages/coding-agent/src/core/auth/keychain.ts`（新） | 移植 Kocoro `internal/keychain/`：`Backend` 接口 + `osBackend`（darwin）/ `memBackend`（测试）/ `errUnsupportedPlatform`（other）。Service 命名 `ai.pi-mono.daemon.api_key`。**回退**：linux/win 走 `FileAuthStorageBackend` 已有路径。**安全**：api_key 字节不进 audit log。 | 单测：darwin 写/读 round-trip；other 平台返 `ErrUnsupportedPlatform`；key 不在 audit 输出。 |
| **K2-02 Auth 状态机** | `packages/coding-agent/src/core/auth/state.ts`（新） + pi-web `app/api/auth/*`（扩） | 移植 Kocoro `daemon/auth.go:AuthManager` 5 态 + `auth_state_changed` 事件。WS 连接仅在 `signed_in` 态；`bootstrapping_key` 时拉 api_key。**新增事件** `auth_state_changed` 走 `EventBus`。 | 单测：5 态合法迁移 + 非法迁移拒绝；事件正确发；WS 在 `signed_in` 之前不连。 |
| **K2-08 Skill 市场** | `packages/coding-agent/src/core/skills/marketplace.ts`（新）+ pi-web `app/api/skills/*`（扩） | 移植 Kocoro `skills/marketplace.go`：`MarketplaceClient`（TTL + stale-on-error）+ `SecurityScan` + provenance 链。**Web 端**增加 `GET /api/skills/marketplace`、`GET /api/skills/marketplace/entry/[slug]`、`POST /api/skills/marketplace/install/[slug]`。**关键不变量**：marketplace 走 Cloud，不本地 install。 | 单测：TTL 命中本地；过期后 stale；stale-on-error 仍能用旧版；安全扫描 → install 拒绝。 |
| **K2-09 Skill 密钥** | `packages/coding-agent/src/core/skills/secrets.ts`（新） | 移植 `skills/secrets.go`：`SecretsStore`（per-skill）+ Keychain 后端 + `IsValidEnvKey`（uppercase + 下划线 + 数字）。**注入时机**：skill load 时把 secrets 转 env；执行结束清空。 | 单测：合法 key 通过；非法 key 拒绝；注入后进程环境变量含该 key；执行结束清空。 |
| **K2-10/11/12 Skill 系统** | `packages/coding-agent/src/core/skills/{provenance,validate,filter}.ts`（新） | 移植：(a) provenance（marketplace 安装时写 `{slug, sha, source}`）；(b) validate（`SecurityScan` 触发点）；(c) `allowed-tools` 执行期强制（不通过 schema 过滤）— 保持 prompt cache 稳定；(d) `desktopOnlySkills` 过滤器（Web 端不向 API 用户暴露）。 | drift test：marketplace 装的 skill 有 provenance；`allowed-tools` 执行期拒（schema 仍声明）；Web 端 GET 不含 desktop-only。 |
| **K2-13 Claude Code 迁移** | `packages/coding-agent/src/migrate/claude-code/{planner,converter_*,applier}.ts`（新） | 移植 Kocoro 5 个 converter（agent / command / mcp / rule / skill）+ `plan_store` + 隐私脱敏 + 预览/应用。**Kocoro 21 个文件的核心算法**直接搬：扫描 → 转换 → 预览 → 用户确认 → 应用。**关键不变量**：原始 `~/.claude/` 不动；preview 阶段所有改动都在 plan_store。 | 单测：5 种 converter 各一份样例；隐私脱敏不漏；预览改应用不破坏原文件。 |
| **K2-14 Session sync** | `packages/coding-agent/src/core/session/sync.ts`（新） | 移植 `internal/sync/`：opt-in + flock + marker + batching + uploader + strip_thinking。**关键不变量**：(1) thinking blocks 在上传前剥离（不污染远端）；(2) flock 用稳定路径、不删 lockfile；(3) 失败条目簿记跨重启。 | 单测：opt-in 默认关；flock 并发互斥；thinking 剥离；失败条目重启仍存在。 |
| **K2-15 审计** | `packages/coding-agent/src/core/audit/{audit,redact}.ts`（新） | 移植 `internal/audit/audit.go:RedactSecrets`（API key / Bearer / `auth.json` 路径）+ 路径截断。**不变量**：key 字节绝不出现在 log / audit / share 输出。 | 单测：含 `sk-...` / `Bearer ...` / `/Users/.../auth.json` 输入被 mask；明文 key 不进 audit。 |

**K2 验收**
- [ ] macOS 把 api_key 写入 Keychain；卸载后从 Keychain 抹除。
- [ ] 5 态 auth 转换走事件总线；Web UI 实时反映。
- [ ] skill 市场可用；安全扫描拒装；provenance 完整。
- [ ] skill 密钥经 Keychain 注入；进程退出后 env 干净。
- [ ] Claude Code 用户一键迁移；原始文件不破坏。
- [ ] opt-in session sync；thinking 不外传。
- [ ] 审计无明文 key。

---

### K3：战略（多通道 + Mac 工作台 + 多智能体 + 记忆）（~10–14 周）

**目标**：让 pi 既能 Web 又能 IM / Desktop / 无人值守。

| 任务 | pi 落点 | 关键改动 | 验收 |
|------|---------|----------|------|
| **K2-04 多通道 IM** | `packages/coding-agent/src/core/channels/{feishu,slack,telegram,...}.ts`（新） | 移植 Kocoro 7 通道 handler：每个通道实现 `ChannelHandler` 接口（parse → enqueue → format reply）。**Web 端不暴露**（cloud-source 走 `desktopOnlySkills` 过滤器）。**关键不变量**：所有消息经过 `event_bus` 中转；UI 渲染走 `output_profiles`（markdown / plain）。 | 集成测试：每通道 mock 一份 inbound；event bus 命中；reply 格式符合该通道 profile。 |
| **K2-05 Channel 路由** | `packages/coding-agent/src/core/channels/router.ts`（新） | 移植 Kocoro 5 段路由：explicit session → threaded → per-sender → agent → legacy channel。**routed managers 长寿命**；bypass/heartbeat 用 short-lived manager。 | 单测：5 段优先级矩阵；routed manager 跨消息共享；bypass 不污染状态。 |
| **K2-06 Capability token** | `packages/coding-agent/src/core/ws/handshake.ts`（新） | 移植 Kocoro `ws_controller.go`：WS 握手返回 capability tokens（`tool_use_id_events` / `schedule_broadcast_gate` / `proactive_thread_mode`）。**关键不变量**：每个新可选协议特性都带一个 capability token。 | 单测：token 列表正确序列化；新 token 加即上 token，加错就 break handshake。 |
| **K2-07 Cloud 委托** | `packages/coding-agent/src/core/tools/cloud-delegate.ts`（新） | 移植 Kocoro `tools/cloud_delegate.go`：长任务 > N 分钟自动上 Cloud（若有 Cloud endpoint）；fallback 本地。**关键不变量**：本地工具 result 不污染 Cloud 上下文（截断）。 | 单测：长任务触发；本地完成不触发；context 截断保留核心。 |
| **K2-16 Hook** | `packages/coding-agent/src/core/hooks/{pre,post,session,stop}.ts`（新） | 移植 Kocoro 4 个 hook 触发点。**新点**：与 pi `ExtensionAPI` 并存，不替代。**关键不变量**：hook 失败不让 tool 失败（best-effort）。 | 单测：4 个触发点；hook 抛错被吞；hook 输出透传 tool result。 |
| **K2-17 SQLite FTS** | `packages/coding-agent/src/core/session/index.ts`（新） | 移植 Kocoro `session/index.go`：trigram 模糊搜索 + `splitQueryTerms`。**关键不变量**：index 与 `.jsonl` 同步增量更新（`UpsertSession`）；`NeedsRebuild` 检测 schema 变更。 | 单测：写入 → 搜索；trigram 命中；schema 变更 → rebuild；rebuild 不破坏现有。 |
| **K3-01 Mac GUI 工具** | `packages/coding-agent/src/core/tools/{calendar,computer,applescript,clipboard}.ts`（新） | 移植 Kocoro 6 个 calendar tool + computer + applescript + clipboard。**darwin-only**；other 平台 stub（`ErrUnsupportedPlatform`）。**关键不变量**：calendar 写入必须经 approval；computer 工具 default always-ask。 | 单测：calendar CRUD round-trip（macOS test env）；computer 工具走 always-ask；other 平台 stub 正确。 |
| **K3-02 文档提取** | `packages/coding-agent/src/core/tools/doc-extract.ts`（新） | 移植 `doc_extract.go`：PDF / Word / Excel。**关键不变量**：抽取后内容经 sanitize（去宏）；二进制/加密 PDF 走 fallback（OCR）。 | 单测：3 种格式各 1 个样例；恶意 PDF 不弹宏。 |
| **K3-03 图像生成 / 编辑** | `packages/coding-agent/src/core/tools/{generate,edit}-image.ts`（新） | 移植 Kocoro 工具 + `imaging_compress.go` 的 source-time 压缩。**关键不变量**：所有图像走 K1-07 三层保护；输出固定可分享 URL。 | 单测：生成 / 编辑 round-trip；超大生成图被压缩；输出 URL 可访问。 |
| **K3-04 Desktop RPC** | `packages/coding-agent/src/core/desktop-rpc/{listener,codec,broker}.ts`（新） | 移植 Kocoro 5 个文件：Unix sock listener + length-prefix codec + DesktopRPCBroker。**用途**：pi 引擎 + 桌面壳解耦（macOS App 走此通道）。**关键不变量**：broker 阻塞调用有 ctx cancel；event frame 与 result frame 不同 type。 | 单测：codec round-trip；broker timeout；ctx cancel 立即返回。 |
| **K3-05 Schedule 主动推送** | `packages/coding-agent/src/core/schedule/{push,broadcast,thread}.ts`（新） | 移植 Kocoro `schedule/` + `broadcast_gate.go`：auto/on/off 三态 + broadcast + thread anchoring。**关键不变量**：默认 auto；无人值守禁用 thread anchoring 强推。 | 单测：3 态转换；broadcast 开关正确；thread 决定是否锚定。 |
| **K3-06 浏览器自动化** | `packages/coding-agent/src/core/tools/{browser,browser-lease}.ts`（新） | 移植 Kocoro browser + lease + handoff：Chrome profile 隔离 + 租约 + session 边界。**关键不变量**：session 关闭 → 租约归还；lease 超时杀进程。 | 单测：租约获取 / 释放；session 关闭后 profile 隔离；lease 超时杀进程。 |
| **K3-07 多智能体** | `packages/coding-agent/src/core/agents/{api,loader,always-allow,usage,validate}.ts`（新） | 移植 Kocoro 7 个文件：per-agent 配置（命令 / 技能 / always-allow / 用量）独立。**关键不变量**：agent 切换不污染 prompt cache（用 source-routing TTL 区分）。 | 单测：2 个 agent 并存；各自 always-allow 独立；用量独立统计。 |
| **K3-08 提示建议** | `packages/coding-agent/src/core/agent/suggestion.ts`（新） | 移植 `agent/suggestion.go`：forked request after success。**关键不变量（cache safety）**：fork 与主请求 byte-equal except（append reply、suggestion prompt、skip-cache-write flag、fork kind）；不改 tools / max tokens / thinking budget / ordering。drift test 验证。 | drift test：fork vs main byte-equal；4 项例外命中；不改 tools / tokens。 |
| **K3-09 + K3-10 记忆 sidecar** | `packages/coding-agent/src/core/memory/{client,sidecar,bundle,audit,tenant,preflight}.ts`（新） | 移植 Kocoro 10 个文件：sidecar lifecycle（NewService / Spawn / WaitReady / Shutdown）+ bundle puller + tenant safety + audit + 错误分类 + preflight。**关键不变量**：(1) API key 不进 audit；(2) preflight 是 in-message only，不持久；(3) 跨租户拒绝。 | 单测：sidecar 启停；bundle pull 走 hash 校验；audit 无 key；preflight 不持久；跨租户拒。 |

**K3 验收**
- [ ] 7 通道 inbound 全部命中；reply 格式正确。
- [ ] 5 段路由矩阵正确；routed manager 跨消息共享。
- [ ] WS 握手 token 正确；新特性带 token。
- [ ] 长任务自动上 Cloud；本地短任务不动。
- [ ] Hook 失败不破 tool；best-effort。
- [ ] 1M session FTS 查询 < 50ms；rebuild 自动触发。
- [ ] Mac GUI 工具在 darwin 工作；other 平台 stub。
- [ ] Desktop RPC codec 双向 round-trip；broker ctx cancel 立即返回。
- [ ] Schedule 推送正确；无人值守不强推。
- [ ] Chrome 租约按时回收；session 关闭后隔离。
- [ ] 多 agent 互不污染；用量独立。
- [ ] 提示建议 cache 字节稳定。
- [ ] 记忆 sidecar 完整生命周期；preflight 不持久；audit 无 key。

---

## 4. 明确不做（避免误吸）

- **不做** Kocoro 的 Cloud WebSocket 长连接（pi 的 Cloud 集成是另一条产品线，Kocoro 自己的 Cloud ≠ pi-mono 的 exe.dev）。
- **不做** Kocoro 的 Desktop Swift 实现（pi-web 用 WKWebView 即可；如要做 Mac App 走 K3-04 RPC 桥而不是复制）。
- **不做** Kocoro 的多通道 IM 路由（这是 Kocoro 的产品主战场，pi 不做"通道型"产品）。
- **不做** Kocoro 的 memory 私有 bundle 协议（如果未来需要，借鉴 `bundle.go` 的 hash 校验 + stale-on-error 即可）。
- **不做** Kocoro 的 `desktopOnlySkills` 过滤器的"desktop"含义（pi 的桌面是 Web，过滤条件改为"web-only"或"非 API 暴露"）。
- **不做** Kocoro 完整的 Cloud 委托协议（仅做客户端 stub + fallback 本地）。

---

## 5. 关键文件地图

### 5.1 Kocoro 端（移植源）

| 领域 | 路径 | 移植阶段 |
|------|------|----------|
| 权限 / always-allow | `internal/permissions/permissions.go` + `internal/agents/always_allow.go` + `internal/daemon/alwaysallow.go` | K1 |
| ValidationError / LoopDetector | `internal/agent/tools.go:ValidationError` + `loopdetect.go` | K1 |
| 工具并发 | `internal/agent/concurrency_safe.go` + `internal/tools/bash_concurrency.go` | K1 |
| 图像三层 | `internal/tools/imaging_compress.go` + `internal/agent/oversize_image.go` + `internal/images/` | K1 |
| 工具预算 | `internal/agent/spill.go` + `toolresult_budget.go` | K1 |
| ReadTracker | `internal/agent/readtracker.go` | K1 |
| ApprovalDescription | `internal/agent/approval_description.go` | K1 |
| Phase + Watchdog | `internal/agent/phase.go` + `watchdog.go` | K2 |
| Cache 稳定性 | `internal/agent/cachemetric.go` + `cache_idempotence_test.go` | K2 |
| Keychain | `internal/keychain/{keychain.go,backend_darwin.go,backend_other.go,backend_mem.go}` | K2 |
| AuthManager | `internal/daemon/auth.go` + `auth_handlers.go` | K2 |
| Skill 市场 / 密钥 / 过滤 | `internal/skills/{marketplace.go,secrets.go,provenance.go,validate.go}` + `internal/daemon/skill_filter.go` | K2 |
| Claude Code 迁移 | `internal/migrate/claudecode/*`（21 个文件） | K2 |
| Session sync | `internal/sync/*`（含 `strip_thinking.go`） | K2 |
| 审计 | `internal/audit/audit.go:RedactSecrets` | K2 |
| Hook | `internal/hooks/hooks.go` | K3 |
| Session FTS | `internal/session/index.go` | K3 |
| Channel 路由 | `internal/daemon/runner.go` + `feishu_handler.go` + `im_bindings.go` | K3 |
| Capability token | `internal/daemon/ws_controller.go` | K3 |
| Cloud 委托 | `internal/tools/cloud_delegate.go` | K3 |
| Mac GUI 工具 | `internal/tools/{calendar_*,computer.go,applescript.go,clipboard.go,ghostty_*.go}` | K3 |
| 文档提取 | `internal/tools/doc_extract.go` | K3 |
| 图像工具 | `internal/tools/{generate_image.go,edit_image.go}` | K3 |
| Desktop RPC | `internal/daemon/desktop_rpc/{listener,codec,broker,types}.go` | K3 |
| Schedule / broadcast | `internal/schedule/*` + `internal/daemon/broadcast_gate.go` | K3 |
| Browser | `internal/tools/{browser.go,browser_lease.go,browser_handoff.go}` | K3 |
| 多智能体 | `internal/agents/{api,loader,always_allow,usage,validate,warnings,embed,builtin}.go` | K3 |
| 提示建议 | `internal/agent/{suggestion.go,suggestion_state.go}` | K3 |
| 记忆 sidecar | `internal/memory/{client,sidecar,service,bundle,audit,tenant,attached_querier,querybatch,errclass,types}.go` | K3 |
| 记忆 preflight | `internal/agent/preflight.go` + `internal/tools/memory_preflight.go` | K3 |

### 5.2 pi 端（落点）

| 领域 | 路径 | 阶段 |
|------|------|------|
| 权限 | `packages/coding-agent/src/core/permissions/{permissions,hardblock,alwaysask,alwaysallow}.ts` | K1 |
| 工具结果 | `packages/coding-agent/src/core/tools/{result,budget,image-protection,description}.ts` | K1 |
| Loopdetect | `packages/coding-agent/src/core/loopdetect.ts`（扩） | K1 |
| ReadTracker | `packages/coding-agent/src/core/tools/readtracker.ts` | K1 |
| 工具并发 | `packages/coding-agent/src/core/tools/concurrency.ts` | K1 |
| Policy | `packages/coding-agent/src/core/tools/policy.ts` | K1 |
| Phase / Watchdog | `packages/coding-agent/src/core/{phase,watchdog}.ts` | K2 |
| Cache 稳定 | `packages/coding-agent/src/core/cache/idempotence.ts` | K2 |
| Keychain | `packages/coding-agent/src/core/auth/keychain.ts` | K2 |
| AuthManager | `packages/coding-agent/src/core/auth/state.ts` | K2 |
| Skill 系统 | `packages/coding-agent/src/core/skills/{marketplace,secrets,provenance,validate,filter,registry}.ts` | K2 |
| Claude Code 迁移 | `packages/coding-agent/src/migrate/claude-code/{planner,converter_*,applier,plan_store}.ts` | K2 |
| Session sync | `packages/coding-agent/src/core/session/sync.ts` | K2 |
| 审计 | `packages/coding-agent/src/core/audit/{audit,redact}.ts` | K2 |
| Hook | `packages/coding-agent/src/core/hooks/{pre,post,session,stop}.ts` | K3 |
| FTS | `packages/coding-agent/src/core/session/index.ts` | K3 |
| Channel | `packages/coding-agent/src/core/channels/{router,feishu,slack,telegram,line,wechat,wechat-work,webhook}.ts` | K3 |
| Capability | `packages/coding-agent/src/core/ws/handshake.ts` | K3 |
| Cloud 委托 | `packages/coding-agent/src/core/tools/cloud-delegate.ts` | K3 |
| Mac GUI 工具 | `packages/coding-agent/src/core/tools/{calendar-*,computer,applescript,clipboard,ghostty-darwin}.ts` | K3 |
| 文档 | `packages/coding-agent/src/core/tools/doc-extract.ts` | K3 |
| 图像 | `packages/coding-agent/src/core/tools/{generate,edit}-image.ts` | K3 |
| Desktop RPC | `packages/coding-agent/src/core/desktop-rpc/{listener,codec,broker,types}.ts` | K3 |
| Schedule | `packages/coding-agent/src/core/schedule/{push,broadcast,thread}.ts` | K3 |
| Browser | `packages/coding-agent/src/core/tools/{browser,browser-lease}.ts` | K3 |
| 多智能体 | `packages/coding-agent/src/core/agents/{api,loader,always-allow,usage,validate}.ts` | K3 |
| 提示建议 | `packages/coding-agent/src/core/agent/suggestion.ts` | K3 |
| 记忆 | `packages/coding-agent/src/core/memory/{client,sidecar,bundle,audit,tenant,preflight}.ts` | K3 |
| Web 端 API | `pi-web/app/api/skills/{marketplace,secrets,provenance}/*` + `app/api/auth/*`（扩） + `app/api/migrate/claude-code/*` + `app/api/session-sync/*` + `app/api/channels/*` | K2/K3 |

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| **权限系统引入破现有 pi 工具** | 灰度：先以 `experimental.permissions` opt-in flag 引入；默认 off；旧路径保留 1 个版本。 |
| **K1-08 三层预算与 Kocoro 略有差异** | drift test：Kocoro Go 单测算法 vs pi TS 单测算法，两边跑同一组 fixture；3 类不变量逐项 cross-validate。 |
| **K2-01 Keychain 在 sandboxed Pi.app 中无访问** | 借鉴 Kocoro `auth.json` 回退：Keychain 写失败时降级到 `FileAuthStorageBackend`；用户配置项可强制回退。 |
| **K2-13 Claude Code 迁移破坏用户数据** | Kocoro 已有 `plan_store` 模式（不动原始文件，仅 preview → apply）；pi 端直接采用。**`privacy_test.go` 同样有**，TS 端写等价测试。 |
| **K2-14 sync 上传 thinking 块** | 移植 `strip_thinking.go` 完整算法；pre-upload hook 强制调用。 |
| **K3-04 Desktop RPC 在 Windows 不可用** | Unix sock only；其他平台 stub。 |
| **K3-07 多智能体破坏 prompt cache** | Kocoro 用 `cache_source` propagation 区分；TS 端保持 `CacheSource` 枚举 + source-routing TTL。 |
| **K3-09 记忆 sidecar 跨租户泄漏** | `tenant.go` 的强制过滤必须放在 client 最外层；单测覆盖「client + 跨租户 query」必拒。 |
| **TS 移植 Go 算法的 drift** | 每个 K1/K2 项必须有 drift test：Kocoro Go 单测 vs pi TS 单测跑同一 fixture。CI 双向跑。 |
| **能力 / 工具爆炸** | 每阶段只引入 8–10 项；agent loop 不改；新能力以 `ExtensionAPI` 注册。 |
| **K3 战略阶段超出 pi 范畴** | K3 是「可选」——可拆给独立 spin-off 或分年度执行；K1+K2 完成时 pi 已能进企业。 |

---

## 7. 资源粗估（单人全栈参考）

| 阶段 | pi-coding-agent 改动（人周） | pi-web 改动（人周） | 配套（人周） |
|------|------------------------------|---------------------|--------------|
| K1 | 6–8 | 1（设置 UI） | 0.5（drift test fixture） |
| K2 | 4–6 | 2（API + 迁移预览） | 0.5（Claude Code 样例） |
| K3 | 8–12 | 4（多通道 Web 桥 + 市场） | 1（端到端 fixture） |
| 合计 | 18–26 | 7 | 2 |

> 假设：1 名熟悉 pi-coding-agent + Kocoro 的工程师全职。

---

## 8. 立即可开工的子任务（按 ROI）

1. **K1-03+K1-04 ValidationError + ErrorCategory** — 改动小（`ToolResult` 加字段 + `loopdetect` 加规则），收益大（防 stuck loop），PI 路径最直接。**drift test** 用 Kocoro 现有 `loopdetect_test.go` 跑同一组 fixture。
2. **K1-05 ApprovalDescription** — 加 `description` 字段到所有 `requireApproval` 工具；UI 面板从 args 切换到 description。Kocoro 的 `description_field_test.go` 可直接复用为 fixture。
3. **K1-09 Loopdetect 完整化** — 补 GUI 工具白名单 + `use_skill` exempt + recovered tail 跳双检。
4. **K1-06 工具并发** — `IsConcurrencySafeCall` 接口 + Bash 静态分析移植；fallback 走 `IsReadOnly`。
5. **K1-08 Tool result 预算** — 三层 spill + persisted replacement map；**最值得做**——是 pi 引擎目前最薄弱的环境。
6. **K1-01 权限系统** — 体量大但有 Kocoro 全套算法可搬；K1-02 联动。
7. **K1-07 图像三层** — 已有 K1-07 算法可搬；`resizeImage` + `enforcePerImageDimensionCap` + `sanitizeToolResultImages`。
8. **K1-10 ReadTracker** — 跨 Run 持久；`file_read` dedup。

> K2 关键项：K2-01 Keychain（macOS 凭据安全刚需）+ K2-13 Claude Code 迁移（用户获取）。
> K3 关键项：K3-07 多智能体（产品化升级）+ K3-09 记忆 sidecar（跨 Run 上下文）。

---

## 9. 与 pi 既有里程碑的对齐

| 阶段 | Kocoro K1 | pi M1.1（M1 已 ship） | 备注 |
|------|-----------|------------------------|------|
| 已 ship | — | 分支树 + Fork/Clone + 三档预设 | Kocoro 没有这些；pi 已有 |
| K1 | 权限/校验/并发/图像/预算/loop/read/description | 缺 | **本计划的核心** |
| K2 | 认证 + 生态（市场/密钥/迁移/sync/审计） | 部分（OAuth + auth.json） | 本计划补全 |
| K3 | 多通道 + Mac + 多智能体 + 记忆 | 缺 | 战略 |

> **关键观察**：pi 在「用户视角的能力」上（M1/M2 场景化 + Web Push + E2EE relay）领先；Kocoro 在「引擎视角的生产硬化」上（权限/校验/并发/预算/loop）领先。**两者的能力集**是互补的。

---

## 10. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-08 | 初稿：方向反过来（Kocoro → pi），列 30 项 K1–K3 阶段能力；逐项对照 Kocoro 现有实现与 pi 缺失，给出 TS 落点 + drift test 要求。 |
