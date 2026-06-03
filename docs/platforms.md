# Cutline Studio — platforms

One Vite/React app (`src/`), two native shells.

| Platform | Shell | Engine | Dev command |
|----------|--------|--------|-------------|
| **macOS (primary)** | Electron | Chromium | `npm run electron:dev` |
| **iPhone / iPad (later)** | Tauri | WebKit | `npx tauri ios dev` (after iOS setup) |
| **Web / Cursor preview** | Browser | Chromium or WebKit | `npm run dev` |

## macOS — Electron

```bash
npm run electron:dev
```

Loads `http://localhost:5173` in development (same UI as the website). Production build:

```bash
npm run electron:build
```

Output: `release/electron/`.

Legacy **Tauri + wrymium (CEF)** macOS build is still available as `npm run tauri:dev` but is no longer the default desktop path.

## iOS — Tauri (not wired yet)

`src-tauri/` is currently patched for **wrymium (macOS CEF)**. Before shipping iOS:

1. Remove wrymium `[patch.crates-io]` from `src-tauri/Cargo.toml` and use stock Tauri/WKWebView.
2. Run `npx tauri ios init` and configure signing.
3. Use `npx tauri ios dev` for device/simulator.

The React app already sets `data-native-desktop` / `data-tauri-desktop` when running inside Tauri.

## Shared UI

Edit `src/` once. Test desktop effects in **Electron** and mobile-safe paths in **Safari / iOS simulator** before release.
