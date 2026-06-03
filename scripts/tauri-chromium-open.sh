#!/usr/bin/env bash
# Open Cutline Studio from Dock / Finder (no Terminal window). Keeps Vite running after quit.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/src-tauri"
DISPLAY_NAME="Cutline Studio"
BUNDLE_NAME="Cutline Studio.app"
BUNDLE_PATH="$TAURI_DIR/target/bundle/$BUNDLE_NAME"
VITE_URL="http://localhost:5173"

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH"

vite_ready() {
  curl -fsS -o /dev/null -m 1 "$VITE_URL" 2>/dev/null
}

start_vite() {
  if vite_ready; then
    return 0
  fi
  if [[ -x "$ROOT/scripts/dev-server.sh" ]]; then
    "$ROOT/scripts/dev-server.sh" start
    for _ in $(seq 1 60); do
      vite_ready && return 0
      sleep 0.5
    done
    return 1
  fi
  (cd "$ROOT" && nohup npm run dev >>"$ROOT/.dev-server.log" 2>&1 &)
  for _ in $(seq 1 60); do
    vite_ready && return 0
    sleep 0.5
  done
  return 1
}

# If the real app is already running, bring it forward.
if pgrep -f "$BUNDLE_PATH/Contents/MacOS/app" >/dev/null 2>&1; then
  open -a "$BUNDLE_PATH" 2>/dev/null || open "$BUNDLE_PATH"
  exit 0
fi

start_vite || {
  osascript -e 'display alert "Cutline Studio" message "Could not start the dev server on http://localhost:5173"' >&2
  exit 1
}

if [[ ! -d "$BUNDLE_PATH" ]]; then
  osascript -e 'display alert "Cutline Studio" message "App not built yet. Run: npm run install:dock"' >&2
  exit 1
fi

# shellcheck source=scripts/resolve-cef-path.sh
source "$ROOT/scripts/resolve-cef-path.sh"
resolve_cef_path "$TAURI_DIR" || true

open "$BUNDLE_PATH"
