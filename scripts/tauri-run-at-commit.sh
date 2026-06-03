#!/usr/bin/env bash
# Run the Tauri shell from a specific git commit (for A/B vs current working tree).
# Usage: bash scripts/tauri-run-at-commit.sh 9818be8
#
# - Checks out the commit in a sibling git worktree (does not touch your main checkout).
# - Vite on :5174, Tauri devUrl patched in that worktree only (current stays on :5173).
# - 9818be8 = first wrymium (Chromium) commit. For pre-Chromium WebKit use parent: ed3560b
set -euo pipefail

COMMIT="${1:?Pass a commit SHA, e.g. 9818be8}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHORT="$(git -C "$ROOT" rev-parse --short "$COMMIT")"
WORKTREE="$(dirname "$ROOT")/cutline-studio-at-${SHORT}"
COMPARE_PORT="${COMPARE_PORT:-5174}"
VITE_URL="http://localhost:${COMPARE_PORT}"

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH"

if [[ ! -d "$WORKTREE" ]]; then
  echo "Creating worktree at $WORKTREE @ $SHORT ..."
  git -C "$ROOT" worktree add "$WORKTREE" "$COMMIT"
fi

if [[ ! -d "$WORKTREE/node_modules" ]]; then
  echo "Installing npm deps in worktree..."
  (cd "$WORKTREE" && npm install)
fi

# Pin dev server port in this worktree only.
perl -pi -e "s|http://localhost:5173|${VITE_URL}|g" "$WORKTREE/src-tauri/tauri.conf.json"
if grep -q "tauri-chromium-dev.sh" "$WORKTREE/package.json" 2>/dev/null; then
  perl -pi -e "s|http://localhost:5173|${VITE_URL}|g" "$WORKTREE/scripts/tauri-chromium-dev.sh"
  perl -pi -e "s|http://localhost:5173|${VITE_URL}|g" "$WORKTREE/scripts/tauri-chromium-open.sh" 2>/dev/null || true
fi

echo ""
echo "Commit: $(git -C "$WORKTREE" log -1 --oneline)"
echo "Worktree: $WORKTREE"
echo "Dev UI:   $VITE_URL  (current checkout keeps :5173)"
echo ""

if grep -q '"tauri:dev"' "$WORKTREE/package.json" 2>/dev/null; then
  echo "Launching Chromium (wrymium) shell from worktree..."
  (cd "$WORKTREE" && npm run tauri:dev)
else
  echo "Launching WebKit (stock tauri dev) from worktree..."
  (cd "$WORKTREE" && npm run tauri dev)
fi
