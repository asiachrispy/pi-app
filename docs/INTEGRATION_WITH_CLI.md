# Using pi-app with pi CLI

pi-app and pi CLI share the same underlying data:

- Sessions: `~/.pi/agent/sessions/`
- Models: `~/.pi/agent/models.json`
- Settings: `~/.pi/agent/settings.json`

This means **any session you create in the CLI automatically appears in pi-app**, and vice versa.

## Setup

### Prerequisites

- Both `pi` CLI and `pi-app` installed (or using `npx`)
- At least one CLI session created: `pi "hello world"`

### Start Both

1. **In Terminal 1 — Start pi-app:**

```bash
pi-app
# Opens http://localhost:30141
```

2. **In Terminal 2 — Use pi CLI as usual:**

```bash
pi "your prompt here"
```

3. **In Browser — Refresh pi-app:** All new sessions appear in the sidebar.

## Shared Data

### Sessions

Sessions live in `~/.pi/agent/sessions/` as `.jsonl` files. They're grouped by working directory in the UI:

```
~/.pi/agent/sessions/
├── <encoded-working-dir-1>/
│   ├── 1718000123_abc123.jsonl
│   └── 1718000456_def456.jsonl
└── <encoded-working-dir-2>/
    └── 1718001000_ghi789.jsonl
```

Both CLI and Web UI read from the same files, so:

- Create a session in CLI → view/edit in Web UI
- Create a session in Web UI → it's immediately in CLI's view too

### Models Configuration

Models are defined in `~/.pi/agent/models.json`:

```json
{
  "models": [
    {
      "id": "claude-opus-4.8",
      "provider": "anthropic",
      "label": "Opus (latest)"
    },
    {
      "id": "gpt-4o",
      "provider": "openai",
      "label": "GPT-4o"
    }
  ],
  "default": "claude-opus-4.8"
}
```

Edit this file → models appear in pi-app's "Models" dropdown (no restart needed).

> Tip: You can also edit models in pi-app's sidebar UI without touching JSON.

## Common Workflows

### Workflow 1: CLI prototyping → Web UI refining

1. Quick prototyping in CLI: `pi "write a function that..."`
2. Switch to Web UI to explore the result:
   - Visualize conversation branches
   - Fork and try different approaches
   - Switch models mid-conversation
3. Back to CLI for next iteration if needed

### Workflow 2: Web UI session management

1. Create session in CLI
2. Open in Web UI for:
   - Browsing past sessions grouped by project
   - Branching conversations visually
   - Managing tool permissions
   - Creating session notes/summaries

### Workflow 3: Model experimentation

1. Configure multiple models in `models.json`
2. Start conversation in CLI or Web UI
3. Switch models mid-chat to compare outputs
4. Web UI makes switching seamless

## Data Directory Isolation (Development)

If developing pi-app locally, use port isolation:

| Purpose | Port | Data Dir | Command |
|---------|------|----------|---------|
| Daily use (production) | 30141 | `~/.pi/agent/` | `npm start` |
| Development | 30142 | `~/tmp/pi-dev-agent/` | `npm run dev` |

This ensures dev changes don't corrupt real sessions.

See [DEVELOPMENT.md](DEVELOPMENT.md#port-isolation) for details.

## Troubleshooting

### Sessions not syncing between CLI and Web UI

1. **Check data directory matches:**

```bash
# CLI sees this by default:
echo $PI_CODING_AGENT_DIR  # Should be empty or ~/.pi/agent/

# Web UI sees this by default:
curl http://localhost:30141/api/config  # Returns data directory
```

2. **Verify sessions exist:**

```bash
ls -la ~/.pi/agent/sessions/
```

3. **Refresh browser:** Hard refresh (Cmd+Shift+R) to clear cached session list.

### Models not appearing after edit

1. Restart pi-app: `Ctrl+C` then `pi-app`
2. Or check models.json for syntax errors: `cat ~/.pi/agent/models.json | jq`
