# Pi / Pi-Web 吸收 Hermes Agent 功能特性方案

> 基于两个系统的代码深度分析，按优先级排序的吸收建议。

---

## 一、高优先级 — 通过 Extension 即可实现（几乎 1:1 移植）

这些功能 Hermes 有现成代码，Pi 可以通过 Extension 快速实现：

### 1. 子代理 / 并行委托（Subagent / Delegation）

- **Hermes 实现**：`tools/delegate_tool.py` — 用 ThreadPoolExecutor 派生子 AIAgent，隔离上下文、受限工具集、自动审批回退
- **Pi 已有基础**：`examples/extensions/subagent/` — 已用 `spawn` 派生 `pi` 子进程实现单/并行/链式子代理
- **可吸收差异**：
  - Hermes 的工具白名单/黑名单机制（`DELEGATE_BLOCKED_TOOLS`）
  - Hermes 的 `toolsets` 分包（给子代理只分基础/高级/完整工具集）
  - Hermes 的子代理审批回调链（自动允许/拒绝/交互式）
  - Hermes 的 `iteration_budget`（限制子代理迭代次数防死循环）

### 2. 高级上下文压缩引擎

- **Hermes 实现**：`agent/context_engine.py` — 可插拔压缩引擎，支持阈值追踪、DAG 构建、保护头部 N 条消息、可替换实现（如 LCM）
- **Pi 现状**：压缩逻辑散落在 `pi-coding-agent` 内部，只支持"摘要化"，无 DAG 结构、无阈值追踪
- **可吸收**：
  - 可插拔压缩引擎接口 → 作为 Pi Extension API 扩展点
  - 压缩进度可视化 + 压缩历史统计
  - 压缩时可注入自定义指令（Hermes 有，Pi 已有但可增强）

### 3. 安全沙箱 / 容器执行

- **Hermes 实现**：`tools/terminal_tool.py` 支持 local / Docker / Modal / Daytona / SSH / Singularity 六种终端后端
- **Pi 现状**：只有本地 `bash`，通过 tmux 间接解决
- **可吸收**：
  - Docker 沙箱一键启动（`docker exec` 内的 bash 工具）
  - Modal 云沙箱（serverless 执行）
  - 沙箱内文件状态缓存（Hermes 有 `file_state.py`）

### 4. 计划模式（Plan Mode）

- **Hermes 实现**：内建 `plan_mode` — 区分"计划阶段"（只读、分析）和"执行阶段"（可写文件）
- **Pi 已有基础**：`examples/extensions/plan-mode/` — 已有 TS 实现
- **可吸收**：计划模式的审批策略差异化（计划阶段自动允许只读操作，执行阶段触发确认）

---

## 二、中优先级 — 需要修改核心架构但价值大

### 5. 记忆系统（Memory）

- **Pi 已有基础**：`examples/extensions/memory.ts` — 已有一个功能完整的记忆 Extension（set/get/search/list/delete + 遗忘曲线 + 项目快照）
- **Hermes 的差距优势**：
  - **跨会话 FTS5 全文搜索** — Pi 只支持关键词匹配，Hermes 用 SQLite FTS5 做全文索引
  - **Honcho AI 用户建模** — Hermes 有 dialectic 用户画像（谁是谁、偏好、习惯）
  - **记忆自动提取** — Hermes 有 `curator.py` 定期 nudging agent 提取知识到记忆
  - **多提供商记忆后端** — Hermes 可插拔 Honcho/Hindsight/Mem0，Pi 的 memory extension 是单一的
  - **`prefetch()` 预取** — Hermes 每轮对话前后台预取相关记忆注入 context
- **建议**：将 Pi 的 `memory.ts` 升级为生产级 Extension，增加 FTS5（用 SQLite）、预取、自动提取

### 6. MCP 集成

- **Hermes 实现**：`tools/mcp_tool.py` — 内建 MCP 客户端，支持 stdio/HTTP/SSE 传输，自动发现工具、并行调用、采样支持、自动重连
- **Pi 哲学**：刻意不内置 MCP（"你不需要 MCP"）
- **但可吸收**：
  - 作为 **Pi Package** 安装，而非内置
  - 提供标准的 MCP 连接 Extension（`mcp-server.ts`）
  - 借鉴 Hermes 的 `mcp_oauth_manager.py`（OAuth 凭证管理）
  - 借鉴 `mcp_startup.py`（启动时自动发现/加载 MCP 服务器）

### 7. 多平台消息网关

- **Hermes 实现**：`gateway/run.py` — Telegram/Discord/Slack/WhatsApp/Signal/DingTalk/飞书/Matrix/HomeAssistant/SMS，统一 Gateway 进程
- **Pi 现状**：pi-web 通过 SSE 提供 API，但无跨平台消息集成
- **可吸收**：
  - 作为 **Pi Package** 提供 Telegram Bot 集成
  - 借鉴 Hermes Gateway 的 `pairing` 安全机制（DM 配对认证）
  - 借鉴 Hermes 的 `session_context.py`（跨平台会话一致性）
  - **不建议** 做全平台，优先 Telegram/Discord 即可

---

## 三、低优先级 — 需要大幅改造，价值有限

### 8. 定时任务（Cron）

- **Hermes 实现**：`cron/scheduler.py` + `cron/jobs.py` — 自然语言 cron、多平台交付、输出归档
- **Pi 现状**：无内置 cron
- **可行性**：可以作为 Extension 实现，但编码代理场景需求有限

### 9. 浏览器控制

- **Hermes 实现**：`tools/browser_tool.py`（CamoFox）+ `browser_dialog_tool.py`（弹窗处理）
- **Pi 现状**：无
- **可行性**：作为 Extension 可行（通过 Node.js 的 puppeteer/playwright 替代方案）

### 10. 图像/视频/TTS 生成

- **Hermes 实现**：`tools/image_generation_tool.py`、`video_generation_tool.py`、`tools/tts_tool.py`、`tools/transcription_tools.py`
- **Pi 现状**：无
- **可行性**：作为 Extension 可行（通过 API 调用），但编码代理场景使用频率低

### 11. Serverless 部署（Modal/Daytona）

- **Hermes 实现**：`tools/environments/` 支持 Modal/Daytona serverless 环境
- **Pi 现状**：无
- **价值**：编码代理通常是本地交互式使用，serverless 场景有限

### 12. 自学习 / 技能自创建

- **Hermes 核心特色**：任务完成后自动创建技能文件，技能使用中自改进
- **Pi 哲学**：技能是静态声明的，不自动创建
- **价值**：与 Pi 的极简哲学相悖，不建议内置，但可以作为高级 Extension

---

## 四、Pi-Web 可吸收的 UI/UX 特性

| 特性 | Hermes | Pi-Web | 吸收可行性 |
|---|---|---|---|
| **Web 仪表板** | 内建 FastAPI + Vite SPA，配 `hermes web` 命令 | 已有 `pi-web` 核心功能 | ✅ 已有 |
| **实时 token 用量可视化** | 仪表盘展示 token 消耗趋势 | Pi-Web 有 `/api/usage` 但 UI 简单 | ⚡ 增强 |
| **多会话并行视图** | 单会话为主 | 会话浏览器 + 分支 | ⚡ 增强 |
| **Xterm.js 终端嵌入** | Hermes Desktop 有 | ❌ 无 | 🔧 可做 |
| **文件差异对比** | 无 | 无 | ❌ |
| **分支可视化 DAG** | 无（单文件 JSONL 树） | `/tree` 导航 | ⚡ DAG 可视化是亮点 |
| **工具调用时间线** | TUI 内流式展示 | Pi-Web 有但较简单 | ⚡ 可借鉴 Hermes TUI 的工具输出折叠/展开 |

---

## 五、总结：建议实施的 Top 5

| 优先级 | 功能 | 方式 | 工作量 | 价值 |
|---|---|---|---|---|
| 🥇 | **记忆系统增强** | 升级 `memory.ts` Extension（FTS5 + 预取 + 自动提取） | 中 | 高 — 跨会话记忆是 Pi 的明显短板 |
| 🥈 | **MCP 集成** | 新建 `@earendil-works/pi-mcp` 包 | 中 | 高 — 生态集成，社区呼声大 |
| 🥉 | **Docker 沙箱** | Extension + Docker API | 低-中 | 高 — 安全执行需求真实存在 |
| 4 | **子代理增强** | 完善 `subagent` Extension（budget + toolset） | 低 | 中 — 已有基础，补全即可 |
| 5 | **计划模式** | 完善 `plan-mode` Extension | 低 | 中 — 已有基础，补全审批策略 |

---

## 核心原则

Pi 的哲学是 **"minimal core + maximum extensibility"**。上述功能中，**不应该内置**，而应该作为 **Pi Package / Extension / Skill** 提供。

Hermes 的很多功能（记忆/MCP/子代理/cron/浏览器）在 Hermes 是"内置的"，但在 Pi 的最佳做法是"社区维护的包"——这正是 Pi 与 Hermes 的根本分歧，也是 Pi 架构的优势所在。
