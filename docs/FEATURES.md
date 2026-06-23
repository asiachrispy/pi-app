# pi-app Features

## Session Browser

**What it does:** Browse all pi agent sessions in one place, automatically grouped by working directory.

**How to use:**

1. Open pi-app (http://localhost:30141)
2. Left sidebar shows all sessions grouped by project
3. Click a session to open it
4. Search box filters by session name or path
5. Rename sessions by right-clicking

**Why it matters:** Instead of scattered `.jsonl` files, you get a unified view of all your agent interactions.

---

## Real-time Chat

**What it does:** Send messages to your agent with streaming responses. Full SSE support.

**How to use:**

1. Open a session (or create a new one)
2. Type in the message box at the bottom
3. Hit Enter to send
4. Watch the agent's response stream in real-time
5. Click the stop button (⏹️) to interrupt

**Key features:**

- Mid-chat model switching (change LLM without restarting)
- Tool panel (enable/disable tools the agent can use)
- Message editing (re-send a message with edits)
- Session compression (summarize long conversations to save context)

---

## Session Forking

**What it does:** Create a branch from any point in a conversation. Changes don't affect the original session.

**How to use:**

1. Hover over any user message in the conversation
2. Click "Fork from here"
3. A new `.jsonl` file is created as a child of the original
4. Continue the conversation in the new branch
5. Both sessions are visible in the sidebar

**Why it matters:** Experiment without losing your original line of reasoning.

---

## Branch Navigation

**What it does:** When a session has multiple branches (created via forking), visualize and switch between them.

**How to use:**

1. In a branched session, look for the "Branches" indicator in the UI
2. Click to see branch tree
3. Click any branch to switch
4. Optional: "Summarize before switching" to auto-summarize the branch you're leaving

**Visual tree shows:**

- Branch point (the message where it split)
- All branches descending from that point
- Current branch highlighted

---

## Model Switching

**What it does:** Change LLM mid-conversation without restarting.

**How to use:**

1. Look for the "Model" dropdown in the top bar
2. Select a different model from the list
3. Next message uses the new model
4. All previous messages stay in context

**Supported providers:**

- Anthropic (Claude models)
- OpenAI (GPT models)
- Custom providers (configured in models.json)

---

## File Browser

**What it does:** Quick access to files in the current working directory without leaving pi-app.

**How to use:**

1. Look for the file icon in the left sidebar
2. Browse the directory tree
3. Click a file to view its contents
4. Copy file path or insert into message

---

## Session Summaries

**What it does:** Automatically or manually summarize conversations. Summaries appear as collapsible blocks in the timeline.

**How to use:**

1. **Manual:** Click the "Add Summary" button and type a note
2. **Automatic:** pi-app can auto-generate summaries at conversation breaks
3. Click summary to expand/collapse
4. Summaries help you understand old sessions at a glance

**Use for:**

- Quick session recap before context compression
- Milestone markers in long conversations
- Session organization

---

## Tool Panel

**What it does:** View and enable/disable tools the agent can use in this session.

**How to use:**

1. Look for "Tools" panel in the sidebar
2. Toggle tools on/off
3. Changes take effect immediately
4. Agent respects your settings in the next message

**Common tools:**

- Bash execution
- File I/O
- Web requests
- Code execution

---

## Remote Access

**What it does:** Access pi-app from another device on your network or over the internet.

**How to use:**

1. Open Settings (⚙️ icon)
2. Toggle "Remote Access" ON
3. Choose authentication method:
   - **Pairing link:** One-time setup link to share with trusted users
   - **Bearer token:** Persistent auth token for scripts/automation
4. Share the link or token

**Security:**

- Token-authenticated (no passwords)
- Optional IP whitelist
- Session-based access control

See [remote-access.md](remote-access.md) for detailed setup.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+K (Mac) / Ctrl+K (Linux/Win) | Focus search |
| Cmd+L (Mac) / Ctrl+L (Linux/Win) | Focus message input |
| Esc | Close modal / deselect |
| Enter | Send message |

---

## Settings

**Data Directory:** Change where sessions are stored (default: `~/.pi/agent/`)

**Model Configuration:** Edit available models and set default

**Remote Access:** Enable/configure remote access

**Tool Permissions:** Global tool settings

**Theme:** Dark / Light mode (respects system preference)
