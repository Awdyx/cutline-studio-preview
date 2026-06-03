#!/usr/bin/env bash
# Cutline Studio — production build with wrymium (Chromium/CEF) bundling.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/src-tauri"
DISPLAY_NAME="Cutline Studio"

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

cd "$ROOT"
npm run build

cd "$TAURI_DIR"
cargo build --bin app --release

# shellcheck source=scripts/resolve-cef-path.sh
source "$ROOT/scripts/resolve-cef-path.sh"
resolve_cef_path "$TAURI_DIR"

exec cargo wrymium bundle --release --display "$DISPLAY_NAME" "$@"
