# pi-app

Web UI for the Pi AI coding agent.

## Quick Navigation

- ⚡ **New here?** → [Installation](#getting-started)
- 🔧 **Already using pi CLI?** → [Integration](#already-a-pi-cli-user)
- 💻 **Want to contribute?** → [Development](#development)

## What is pi-app?

Pi ecosystem has three components:

| Component | Role |
|-----------|------|
| **pi** | AI agent engine, CLI, multi-LLM support, tool invocation, session management |
| **pi-app** (this repo) | Web frontend, macOS application, optional remote access |
| **Your workflow** | Use via CLI (`pi`), browser, or desktop app — all connected to the same agent |

**pi-app is the web UI and macOS shell for one local pi agent installation.** When you run pi-app, it reads sessions from `~/.pi/agent/` (same location as pi CLI) and displays them in the browser. Both tools operate on the same data.

## Why pi-app?

**Session Management** — Browse all conversations in one place, automatically grouped by working directory. Visualize, rename, and organize sessions.

**Real-time Interaction** — Stream output, switch models mid-chat, fork conversations into branches, and manage tools without restarting.

**Multi-platform** — Web (all browsers), macOS app, optional remote access. Local-first data storage with optional cloud sync.

## Getting Started

### I want to use pi-app

**No installation needed:**

```bash
npx pi-app@latest
```

Then open [http://localhost:30141](http://localhost:30141).

**Or install globally:**

```bash
npm install -g pi-app
pi-app
```

**Configuration:**

```bash
pi-app --port 8080               # Custom port
pi-app --hostname 127.0.0.1      # Localhost only
pi-app --remote                  # Open to network
PORT=8080 pi-app                 # Environment variable
```

**First time?** See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for detailed setup, troubleshooting, and configuration options.

---

## Already a pi CLI user?

pi-app and pi CLI share the same sessions and models. When you start pi-app, all your existing CLI sessions appear in the browser UI.

**Setup:**

1. Ensure both pi and pi-app are installed
2. Run `pi-app` to start the web server
3. Open http://localhost:30141
4. Your CLI sessions appear in the left sidebar

From the web UI, you can:

- Browse and organize sessions from different projects
- Visualize conversation branches
- Switch models mid-chat
- Edit tool permissions
- Create session notes and summaries

**Learn more:** [docs/INTEGRATION_WITH_CLI.md](docs/INTEGRATION_WITH_CLI.md)

---

## Want to contribute?

pi-app is a Next.js + TypeScript project. We welcome contributions:

**Setup for development:**

```bash
git clone https://github.com/asiachrispy/pi-app.git
cd pi-app
npm install
npm run dev          # http://localhost:30142 (dev server + hot reload)
npm run build && npm start  # http://localhost:30141 (production)
```

**Key principles:**

- Port 30141: daily use (production build)
- Port 30142: development (hot reload, isolated data)
- Run tests before submitting PRs: `npm run test:run`

**Project structure:** [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)  
**Architecture overview:** [docs/DEVELOPMENT.md#architecture-overview](docs/DEVELOPMENT.md#architecture-overview)  
**Contributing guide:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Features

| Feature | What it does |
|---------|--------------|
| **Session Browser** | Browse all sessions grouped by working directory |
| **Real-time Chat** | Stream output, mid-chat model switching, message editing |
| **Session Forking** | Branch conversations at any point without losing original |
| **Branch Navigator** | Visualize and switch between branches |
| **File Browser** | Quick access to files in your working directory |
| **Tool Panel** | Enable/disable agent tools per session |
| **Session Summaries** | Auto or manual summaries for long conversations |
| **Model Switching** | Change LLM without restarting |
| **Remote Access** | Optional access from other devices (pairing link + token auth) |

**Detailed feature guide:** [docs/FEATURES.md](docs/FEATURES.md)

---

## Security & Privacy

**Local-first:** By default, pi-app binds to `localhost:30141`. All data stays on your machine.

**Remote access:** Opt-in with `--remote` flag. Uses token-based authentication (no passwords). See [docs/remote-access.md](docs/remote-access.md).

**Data directory:** Sessions stored in `~/.pi/agent/sessions/` by default. Change with `PI_CODING_AGENT_DIR` environment variable.

---

## Useful Links

- **Product philosophy:** [docs/product-principles.md](docs/product-principles.md)
- **macOS app details:** [macos/README.md](macos/README.md)
- **Historical context:** [Pi ecosystem overview](../README.md)

---

## License

MIT
