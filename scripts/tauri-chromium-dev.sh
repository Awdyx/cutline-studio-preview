#!/usr/bin/env bash
# Cutline Studio — Tauri + wrymium (Chromium/CEF) dev launcher.
# Do not use `tauri dev` or plain `cargo run`; CEF needs `cargo wrymium run` + .app bundle.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/src-tauri"
DISPLAY_NAME="Cutline Studio"
VITE_URL="http://localhost:5173"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd cargo
require_cmd npm

if ! cargo wrymium --help >/dev/null 2>&1; then
  echo "Install cargo-wrymium first:" >&2
  echo "  cargo install cargo-wrymium --git https://github.com/gxcsoccer/wrymium" >&2
  exit 1
fi

if ! command -v cmake >/dev/null 2>&1 || ! command -v ninja >/dev/null 2>&1; then
  echo "CEF build needs cmake and ninja:" >&2
  echo "  brew install cmake ninja" >&2
  exit 1
fi

vite_ready() {
  curl -fsS -o /dev/null -m 1 "$VITE_URL" 2>/dev/null
}

start_vite() {
  if vite_ready; then
    echo "Vite already serving at $VITE_URL"
    return
  fi
  if [[ -x "$ROOT/scripts/dev-server.sh" ]]; then
    echo "Starting persistent Vite dev server (dev-server.sh)..."
    "$ROOT/scripts/dev-server.sh" start
    for _ in $(seq 1 60); do
      if vite_ready; then
        echo "Vite ready at $VITE_URL"
        return
      fi
      sleep 0.5
    done
    echo "Timed out waiting for Vite at $VITE_URL" >&2
    exit 1
  fi
  echo "Starting Vite dev server..."
  (cd "$ROOT" && npm run dev) &
  VITE_PID=$!
  for _ in $(seq 1 60); do
    if vite_ready; then
      echo "Vite ready at $VITE_URL"
      return
    fi
    sleep 0.5
  done
  kill "$VITE_PID" 2>/dev/null || true
  echo "Timed out waiting for Vite at $VITE_URL" >&2
  exit 1
}

cleanup() {
  if [[ -n "${VITE_PID:-}" ]]; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

start_vite

echo "Compiling Rust (first run can take a while)..."
(cd "$TAURI_DIR" && cargo build --bin app 2>&1 | tail -5) || {
  echo "Rust build failed. Run: cd src-tauri && cargo build --bin app" >&2
  exit 1
}

# shellcheck source=scripts/resolve-cef-path.sh
source "$ROOT/scripts/resolve-cef-path.sh"
resolve_cef_path "$TAURI_DIR"

echo "Bundling and launching Cutline Studio (Chromium)..."
cd "$TAURI_DIR"
exec cargo wrymium run --display "$DISPLAY_NAME" "$@"
