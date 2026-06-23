# Development Guide

## Local Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Clone and Install

```bash
git clone https://github.com/asiachrispy/pi-app.git
cd pi-app
npm install
```

## Port Isolation Principle

**Core rule:** Port 30141 is for production/daily use. Port 30142 is for development.

| Use Case | Port | Command | Data Dir | Notes |
|----------|------|---------|----------|-------|
| **Daily Use** | 30141 | `npm start` | `~/.pi/agent/` | Stable, production build |
| **Development** | 30142 | `npm run dev` | `~/tmp/pi-dev-agent/` | Hot reload, dev build |

**Why:** This isolates changes. You can develop without affecting your real sessions.

## Development Commands

### Start Development Server

```bash
npm run dev
```

Opens http://localhost:30142 with hot reload. Changes to `.tsx` / `.ts` files auto-refresh.

Data directory automatically set to `~/tmp/pi-dev-agent/` (separate from daily use).

### Build for Production

```bash
npm run build
```

Creates `.next/` optimized build (production bundle).

### Start Production Build

```bash
npm run build && npm start
```

Starts on port 30141. This is what users see when they install globally.

### Run Tests

```bash
npm run test              # Watch mode
npm run test:run         # Single run
```

### Linting

```bash
npm lint
```

## Project Structure

```
pi-app/
├─ app/
│  ├─ api/              # API routes (Next.js app router)
│  │  ├─ sessions/      # Session CRUD, reading .jsonl files
│  │  ├─ agent/         # Agent communication (RPC, SSE streams)
│  │  ├─ files/         # File browsing and content reading
│  │  └─ models/        # Model list, defaults
│  │
│  └─ (page.tsx, etc)   # Page layouts, session UI
│
├─ components/          # Reusable React components
│  ├─ SessionBrowser.tsx
│  ├─ ChatBox.tsx
│  ├─ BranchNavigator.tsx
│  └─ ...
│
├─ lib/
│  ├─ session-reader.ts    # Parse .jsonl session files
│  ├─ rpc-manager.ts       # Manage agent session lifecycle
│  ├─ normalize.ts         # Normalize toolCall fields
│  ├─ types.ts             # TypeScript types
│  └─ ...
│
├─ public/              # Static assets
├─ scripts/             # Build, packaging, utilities
├─ .next/               # Production build output
├─ .next-dev-30142/     # Dev build output (separate from production)
└─ package.json
```

## Architecture Overview

### Data Flow

1. **Session files** (`~/.pi/agent/sessions/*.jsonl`) are the source of truth
2. **Session Reader** (lib/session-reader.ts) parses .jsonl into structured data
3. **API routes** serve that data to the frontend
4. **React components** display and interact with sessions
5. **Agent RPC** sends messages back to pi CLI/engine

### Key Modules

**SessionReader** (`lib/session-reader.ts`)

- Reads and parses .jsonl session files
- Returns structured conversation messages

**RPCManager** (`lib/rpc-manager.ts`)

- Manages agent session lifecycle (start, stop, message handling)
- Handles SSE streams for real-time chat

**API Routes**

- `/api/sessions` — list, create, delete sessions
- `/api/agent` — send messages, receive SSE stream
- `/api/files` — read file contents
- `/api/models` — list and configure models

## Testing

### Running Tests

```bash
npm run test:run
```

Tests are in `lib/__tests__/` (unit tests for utilities).

### Test Coverage

Focus on:

- Session parsing edge cases
- RPC message handling
- API route error handling

UI component testing is lighter (use Playwright for e2e if needed).

## macOS App Development

### Build macOS App

```bash
npm run package:macos
```

Creates `dist/macos/Pi.app` (Next.js standalone bundle + internal Node + Swift shell).

### Install Locally

```bash
rm -rf /Applications/Pi.app
ditto dist/macos/Pi.app /Applications/Pi.app
open /Applications/Pi.app
```

### Common Issues

- **"Cannot open" error:** `xattr -cr /Applications/Pi.app`
- **Code sign issues:** See [macos/README.md](../macos/README.md)

## Debugging

### Enable Debug Logs

```bash
DEBUG=* npm run dev
```

### Check Browser Console

Open DevTools (F12) → Console tab. Look for:

- Network errors (Failed to fetch)
- Session parsing errors
- RPC message format issues

### Check Server Logs

Terminal running `npm run dev` shows:

- Next.js build messages
- API call logs
- Error traces

## Before Submitting a PR

1. **Tests pass:** `npm run test:run`
2. **Linting passes:** `npm run lint`
3. **Manual smoke test:**
   - Start `npm run dev`
   - Create/open a session
   - Send a message
   - Switch models
   - Check console for errors
4. **No console errors:** DevTools console should be clean

## Useful Commands

```bash
# Clean all build artifacts
rm -rf .next .next-dev-30142 node_modules
npm install && npm run build

# Check what changed vs main
git diff main...HEAD

# Test on production build locally
npm run build && npm start  # Then visit http://localhost:30141
```
