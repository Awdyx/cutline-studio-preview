#!/usr/bin/env bash
# Resolve CEF_PATH for cargo-wrymium (expects $CEF_PATH/Release/Chromium Embedded Framework.framework).
# Sourced by tauri-chromium-*.sh — do not run directly unless testing.
resolve_cef_path() {
  local tauri_dir="${1:?tauri dir required}"

  if [[ -n "${CEF_PATH:-}" ]] && [[ -d "${CEF_PATH}/Release/Chromium Embedded Framework.framework" ]]; then
    return 0
  fi

  local home_cef=""
  shopt -s nullglob 2>/dev/null || true
  for dir in "$HOME/.local/share/cef"/cef_binary_*_minimal; do
    if [[ -d "$dir/Release/Chromium Embedded Framework.framework" ]]; then
      home_cef="$dir"
      break
    fi
  done

  if [[ -n "$home_cef" ]]; then
    export CEF_PATH="$home_cef"
    echo "Using CEF from $CEF_PATH"
    return 0
  fi

  local built=""
  local framework_dir=""
  framework_dir="$(find "$tauri_dir/target" -type d -name 'Chromium Embedded Framework.framework' -path '*/cef-dll-sys-*/out/*' 2>/dev/null | head -1)"
  if [[ -n "$framework_dir" ]]; then
    built="$(dirname "$framework_dir")"
  fi
  if [[ -n "$built" && -d "$built/Chromium Embedded Framework.framework" ]]; then
    local wrapper="$tauri_dir/target/.cef-bundle-root"
    mkdir -p "$wrapper/Release"
    ln -sfn "$built/Chromium Embedded Framework.framework" "$wrapper/Release/Chromium Embedded Framework.framework"
    export CEF_PATH="$wrapper"
    echo "Using CEF from cargo build ($built)"
    return 0
  fi

  echo "CEF not found. Run a build first, or install manually:" >&2
  echo "  cargo install export-cef-dir && export-cef-dir --force ~/.local/share/cef" >&2
  return 1
}
