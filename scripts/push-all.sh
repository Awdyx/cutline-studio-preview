#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STUDIO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPANY_ROOT="$(cd "$STUDIO_ROOT/../cutline-2.0" && pwd)"
WEB_DIR="$COMPANY_ROOT/web"

# remote_name|github_repo_slug|live_url_label
PERSONAL_DEMOS=(
  "public-demo|cutline-studio-demo|awdyx.github.io/cutline-studio-demo"
  "public-demo-play|cutline-studio-play|awdyx.github.io/cutline-studio-play"
)

AUDIO_GIT_PATH="public/audio/account-selection.mp3"
AUDIO_MIN_BYTES=1000000

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

ensure_tracked_audio() {
  git cat-file -e "HEAD:$AUDIO_GIT_PATH" 2>/dev/null \
    || die "Required audio missing from git ($AUDIO_GIT_PATH). Restore it before pushing."

  local size
  size="$(git cat-file -s "HEAD:$AUDIO_GIT_PATH")"
  if (( size < AUDIO_MIN_BYTES )); then
    die "Audio asset in git looks truncated ($size bytes): $AUDIO_GIT_PATH"
  fi
}

ensure_worktree_audio() {
  if [[ -f "$STUDIO_ROOT/$AUDIO_GIT_PATH" ]]; then
    return
  fi

  step "Restoring missing audio asset from git ($AUDIO_GIT_PATH)…"
  git checkout HEAD -- "$AUDIO_GIT_PATH"
  [[ -f "$STUDIO_ROOT/$AUDIO_GIT_PATH" ]] \
    || die "Failed to restore $AUDIO_GIT_PATH into the working tree."
  done_msg "Audio asset restored locally"
}

build_pages_dist() {
  local pages_repo="$1"
  local out_dir="$2"

  step "Building personal demo for GitHub Pages ($pages_repo)…"
  if ! (
    cd "$STUDIO_ROOT"
    GITHUB_PAGES=true GITHUB_PAGES_REPO="$pages_repo" npm run build:pages -- --outDir "$out_dir"
  ) >/dev/null 2>&1; then
    die "GitHub Pages build failed for $pages_repo."
  fi

  if [[ ! -f "$out_dir/audio/account-selection.mp3" ]]; then
    die "Pages build is missing dist/audio/account-selection.mp3 (demo would ship without music)."
  fi

  done_msg "Pages build ready for $pages_repo (includes audio)"
}

publish_personal_demo_live() {
  local remote_name="$1"
  local pages_repo="$2"
  local live_label="$3"

  local demo_url build_dir deploy_dir
  demo_url="$(git remote get-url "$remote_name")"
  build_dir="$(mktemp -d "${TMPDIR:-/tmp}/cutline-pages-build.XXXXXX")"
  deploy_dir="$(mktemp -d "${TMPDIR:-/tmp}/cutline-pages-deploy.XXXXXX")"

  build_pages_dist "$pages_repo" "$build_dir"
  cp -R "$build_dir/." "$deploy_dir/"
  rm -rf "$build_dir"
  touch "$deploy_dir/.nojekyll"

  step "Publishing live demo (gh-pages → $live_label/)…"
  (
    cd "$deploy_dir"
    git init -q
    git add -A
    git -c user.name="Cutline Push" -c user.email="push@cutline.studio" \
      commit -qm "Deploy $(git -C "$STUDIO_ROOT" log -1 --pretty=format:'%h %s')"
    git push -f "$demo_url" HEAD:gh-pages
  )
  rm -rf "$deploy_dir"
  done_msg "Live demo published ($pages_repo → gh-pages)"
}

ensure_tracked_audio
ensure_worktree_audio

step "Syncing cutline-studio → cutline-2.0/web/"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude .cursor \
  --exclude .env \
  --exclude '.env.*' \
  --exclude Dockerfile \
  --exclude server.js \
  --exclude scripts/push-all.sh \
  --exclude 'public/audio/' \
  "$STUDIO_ROOT/" "$WEB_DIR/"

mkdir -p "$WEB_DIR/public/audio"
rsync -a "$STUDIO_ROOT/public/audio/" "$WEB_DIR/public/audio/"
[[ -f "$WEB_DIR/$AUDIO_GIT_PATH" ]] \
  || die "Company web missing audio after sync ($AUDIO_GIT_PATH)."
done_msg "Synced to company web/"

LIVE_DEMO_URLS=()

for entry in "${PERSONAL_DEMOS[@]}"; do
  IFS='|' read -r remote_name pages_repo live_label <<< "$entry"

  if ! git remote get-url "$remote_name" &>/dev/null; then
    echo "⚠ Skipping $pages_repo — git remote \"$remote_name\" not configured."
    continue
  fi

  step "Pushing personal demo source (github.com/Awdyx/$pages_repo)"
  git push "$remote_name" main
  done_msg "Personal demo source pushed ($pages_repo → main)"

  publish_personal_demo_live "$remote_name" "$pages_repo" "$live_label"
  LIVE_DEMO_URLS+=("https://${live_label}/")
done

cd "$COMPANY_ROOT"

if [[ -n "$(git status --porcelain -- web)" ]]; then
  if [[ ! -f "$WEB_DIR/$AUDIO_GIT_PATH" ]]; then
    die "Company web missing audio asset; refusing to commit sync."
  fi

  SYNC_MSG="Sync cutline-studio ($(git -C "$STUDIO_ROOT" log -1 --pretty=format:'%h %s'))"
  git add web

  if git diff --cached --name-only --diff-filter=D -- web | grep -Fq "web/public/audio/account-selection.mp3"; then
    die "Sync would delete web/public/audio/account-selection.mp3 from company web/. Aborting."
  fi

  git commit -m "$SYNC_MSG"
  done_msg "Committed to company repo"
else
  done_msg "Company web/ already up to date (no new commit needed)"
fi

step "Pushing company repo (github.com/Cutline-Tutoring/cutline-2.0)"
git push origin main
done_msg "Company repo updated"

echo ""
echo "All done — personal demo live site(s) + company GitHub are in sync."
for url in "${LIVE_DEMO_URLS[@]}"; do
  echo "Live demo: $url"
done
echo "If a site looks stale, set GitHub → Settings → Pages → Deploy from branch → gh-pages → / (root)."
