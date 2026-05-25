#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STUDIO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPANY_ROOT="$(cd "$STUDIO_ROOT/../cutline-2.0" && pwd)"
WEB_DIR="$COMPANY_ROOT/web"

die() { echo "Error: $*" >&2; exit 1; }
step() { echo "→ $*"; }
done_msg() { echo "✓ $*"; }

[[ -d "$STUDIO_ROOT/.git" ]] || die "cutline-studio git repo not found at $STUDIO_ROOT"
[[ -d "$COMPANY_ROOT/.git" ]] || die "Company repo not found at $COMPANY_ROOT (expected ../cutline-2.0)"
[[ -d "$WEB_DIR" ]] || die "Company web/ folder not found at $WEB_DIR"

cd "$STUDIO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  die "Uncommitted changes in cutline-studio. Commit first, then run: npm run push"
fi

step "Syncing cutline-studio → cutline-2.0/web/"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude Dockerfile \
  --exclude server.js \
  --exclude scripts/push-all.sh \
  "$STUDIO_ROOT/" "$WEB_DIR/"
done_msg "Synced to company web/"

step "Pushing personal demo (github.com/Awdyx/cutline-studio-demo)"
git push public-demo main
done_msg "Personal demo updated"

cd "$COMPANY_ROOT"

if [[ -n "$(git status --porcelain -- web)" ]]; then
  SYNC_MSG="Sync cutline-studio ($(git -C "$STUDIO_ROOT" log -1 --pretty=format:'%h %s'))"
  git add web
  git commit -m "$SYNC_MSG"
  done_msg "Committed to company repo"
else
  done_msg "Company web/ already up to date (no new commit needed)"
fi

step "Pushing company repo (github.com/Cutline-Tutoring/cutline-2.0)"
git push origin main
done_msg "Company repo updated"

echo ""
echo "All done — personal demo + company GitHub are in sync."
