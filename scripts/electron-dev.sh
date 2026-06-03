#!/usr/bin/env bash
# Cutline Studio — Electron (Chromium) macOS dev. UI from Vite on :5173.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VITE_URL="${CUTLINE_DEV_URL:-http://localhost:5173}"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

vite_ready() {
  curl -fsS -o /dev/null -m 1 "$VITE_URL" 2>/dev/null
}

if ! vite_ready; then
  if [[ -x "$ROOT/scripts/dev-server.sh" ]]; then
    echo "Starting Vite (dev-server.sh)..."
    "$ROOT/scripts/dev-server.sh" start
  else
    echo "Starting Vite..."
    (cd "$ROOT" && npm run dev) &
    VITE_PID=$!
    trap 'kill "$VITE_PID" 2>/dev/null || true' EXIT INT TERM
  fi
  for _ in $(seq 1 60); do
    vite_ready && break
    sleep 0.5
  done
  if ! vite_ready; then
    echo "Timed out waiting for $VITE_URL" >&2
    exit 1
  fi
fi

echo "Vite: $VITE_URL"
echo "Launching Electron (Chromium)..."
cd "$ROOT"
exec npx electron .
