#!/usr/bin/env bash
# One-time: build Cutline Studio.app + install a Dock launcher in ~/Applications.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/src-tauri"
DISPLAY_NAME="Cutline Studio"
BUNDLE_NAME="Cutline Studio.app"
BUNDLE_PATH="$TAURI_DIR/target/bundle/$BUNDLE_NAME"
ICON_SRC="$TAURI_DIR/icons/icon.icns"
INSTALL_APP="$HOME/Applications/${BUNDLE_NAME}"
LAUNCHER_NAME="Cutline Studio"

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing: $1" >&2
    exit 1
  }
}

require_cmd cargo
require_cmd npm
require_cmd cmake
require_cmd ninja

if ! cargo wrymium --help >/dev/null 2>&1; then
  echo "Install cargo-wrymium first:" >&2
  echo "  cargo install cargo-wrymium --git https://github.com/gxcsoccer/wrymium" >&2
  exit 1
fi

echo "==> Compiling Cutline Studio (Chromium) — may take several minutes the first time..."
echo "    (Dock app uses the dev server at http://localhost:5173 for live UI updates.)"
(cd "$TAURI_DIR" && cargo build --bin app)

# shellcheck source=scripts/resolve-cef-path.sh
source "$ROOT/scripts/resolve-cef-path.sh"
resolve_cef_path "$TAURI_DIR"

(cd "$TAURI_DIR" && cargo wrymium bundle --display "$DISPLAY_NAME")

RAW_BUNDLE="$TAURI_DIR/target/bundle/app.app"
if [[ ! -d "$RAW_BUNDLE" ]]; then
  echo "Expected bundle at $RAW_BUNDLE" >&2
  exit 1
fi

rm -rf "$BUNDLE_PATH"
mv "$RAW_BUNDLE" "$BUNDLE_PATH"

echo "==> Adding app icon..."
RESOURCES="$BUNDLE_PATH/Contents/Resources"
mkdir -p "$RESOURCES"
cp "$ICON_SRC" "$RESOURCES/AppIcon.icns"

PLIST="$BUNDLE_PATH/Contents/Info.plist"
if [[ -f "$PLIST" ]] && ! grep -q CFBundleIconFile "$PLIST"; then
  # Insert icon key after CFBundleName if possible.
  perl -0pi -e 's/(<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>)/$1\n<key>CFBundleIconFile<\/key>\n<string>AppIcon<\/string>/' "$PLIST" 2>/dev/null || true
fi

echo "==> Installing Dock launcher to ~/Applications..."
rm -rf "$INSTALL_APP"
mkdir -p "$INSTALL_APP/Contents/MacOS" "$INSTALL_APP/Contents/Resources"
cp "$ICON_SRC" "$INSTALL_APP/Contents/Resources/AppIcon.icns"

cat >"$INSTALL_APP/Contents/MacOS/$LAUNCHER_NAME" <<LAUNCHER
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:\$HOME/.cargo/bin:\$PATH"
exec "$ROOT/scripts/tauri-chromium-open.sh"
LAUNCHER
chmod +x "$INSTALL_APP/Contents/MacOS/$LAUNCHER_NAME"

cat >"$INSTALL_APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDevelopmentRegion</key><string>en</string>
<key>CFBundleExecutable</key><string>Cutline Studio</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundleIdentifier</key><string>com.cutline.studio.launcher</string>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>CFBundleName</key><string>Cutline Studio</string>
<key>CFBundleDisplayName</key><string>Cutline Studio</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>0.1.0</string>
<key>LSMinimumSystemVersion</key><string>11.0</string>
</dict></plist>
PLIST

touch "$INSTALL_APP"
xattr -cr "$INSTALL_APP" 2>/dev/null || true
xattr -cr "$BUNDLE_PATH" 2>/dev/null || true

echo ""
echo "Done."
echo "  Chromium app: $BUNDLE_PATH"
echo "  Dock launcher: $INSTALL_APP"
echo ""
echo "Add to Dock:"
echo "  1. Open Finder → Applications"
echo "  2. Drag \"Cutline Studio\" onto the Dock (left of the trash)"
echo "  3. Click it to open the app (starts dev server + Chromium window)"
echo ""
echo "Tip: first Dock click after install may take a moment if Rust needs a rebuild."
