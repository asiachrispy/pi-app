# Getting Started with pi-app

## Installation

### One-liner (no installation)

```bash
npx pi-app@latest
```

Then open [http://localhost:30141](http://localhost:30141).

### Global installation

```bash
npm install -g pi-app
pi-app
```

After installation, `pi` command is also available (points to the embedded pi CLI):

```bash
pi --help
```

### Local development setup

```bash
git clone https://github.com/asiachrispy/pi-app.git
cd pi-app
npm install
npm run dev  # Port 30142 with hot reload
```

## Configuration

### Port and Hostname

```bash
pi-app --port 8080               # Custom port
pi-app --hostname 127.0.0.1      # Localhost only
pi-app --remote                  # Open to 0.0.0.0 for remote access
pi-app -p 8080 -H 127.0.0.1     # Combine flags

# Or use environment variables
PORT=8080 HOSTNAME=0.0.0.0 pi-app
```

### Security Note

By default, pi-app binds to localhost only. Remote access requires explicit flag (`--remote`) or Settings UI. When enabled, authentication uses pairing links or Bearer tokens. See [remote-access.md](remote-access.md) for details.

## Data Directory

pi-app stores sessions in `~/.pi/agent/sessions/` by default (same location as pi CLI).

To use a custom directory:

```bash
PI_CODING_AGENT_DIR=~/my/custom/path pi-app
```

> ⚠️ On macOS app: Use Settings → Data Directory to change location (GUI picker).

## Troubleshooting

### Port Already in Use

If you see "EADDRINUSE" error:

1. Find the process: `lsof -i :30141`
2. Kill it: `kill -9 <PID>`
3. Or use a different port: `pi-app --port 8080`

### Sessions Not Appearing

Make sure `PI_CODING_AGENT_DIR` points to the right directory:

```bash
echo $PI_CODING_AGENT_DIR
ls ~/.pi/agent/sessions/
```

### Models.json Not Found

pi-app reads model configuration from `~/.pi/agent/models.json`. If missing:

1. Run pi CLI at least once: `pi <some-prompt>`
2. Or manually create: `~/.pi/agent/models.json`

See [INTEGRATION_WITH_CLI.md](INTEGRATION_WITH_CLI.md) for format.

## First Use

1. Open http://localhost:30141
2. You should see all pi CLI sessions in the left sidebar (grouped by working directory)
3. Click any session to open it
4. Try sending a message or switching models mid-conversation
