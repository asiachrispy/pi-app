#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-30141}"
TARGET="http://127.0.0.1:${PORT}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found."
  echo "Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  exit 1
fi

echo "Tunneling ${TARGET} via Cloudflare Quick Tunnel"
echo "Ensure pi-web is running with remote auth enabled (pi-web --remote)."
echo ""
exec cloudflared tunnel --url "${TARGET}"
