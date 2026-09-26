#!/usr/bin/env bash
#
# Deploy Carltine.
#
#   ./scripts/deploy.sh build     verify locally, change nothing
#   ./scripts/deploy.sh github    commit and push to GitHub
#   ./scripts/deploy.sh netlify   publish to Netlify
#   ./scripts/deploy.sh all       both, in order
#
# Both remote steps need credentials this machine may not have:
#   github  -> `gh auth login`
#   netlify -> `netlify login`   (interactive, opens a browser)
set -euo pipefail

BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; RESET=$'\033[0m'
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
die()  { printf '%sx%s %s\n' "$RED" "$RESET" "$1" >&2; exit 1; }
step() { printf '\n%s==>%s %s%s%s\n' "$BOLD" "$RESET" "$BOLD" "$1" "$RESET"; }

cd "$(dirname "$0")/.."
TARGET="${1:-build}"

verify() {
  step "Verifying"
  command -v node >/dev/null || die "node is required"
  npx tsc --noEmit || die "typecheck failed"
  ok "typecheck"
  npx eslint . || die "lint failed"
  ok "lint"
  npm run test:chain || die "tamper-detection tests failed"
  npm run test:router || die "routing tests failed"
  npm run build >/dev/null || die "build failed"
  ok "build"
}

deploy_github() {
  step "GitHub"
  command -v gh >/dev/null || die "gh is not installed (brew install gh)"
  gh auth status >/dev/null 2>&1 || die "not logged in. Run: gh auth login"

  if [[ -z "$(git remote get-url origin 2>/dev/null)" ]]; then
    local repo
    read -r -p "Create which GitHub repo? [carltine/carltine]: " repo
    repo="${repo:-carltine/carltine}"
    gh repo create "$repo" --public --source=. --remote=origin \
      --description "Open-source LLM router with a tamper-evident audit trail" \
      --push >/dev/null
    ok "created $repo and pushed"
  else
    git push -u origin HEAD
    ok "pushed to $(git remote get-url origin)"
  fi
}

deploy_netlify() {
  step "Netlify"
  # A first deploy needs an interactive login, which cannot be automated here.
  if ! npx --no-install netlify status >/dev/null 2>&1; then
    warn "not logged in to Netlify."
    printf '   Run this yourself, it opens a browser:\n\n'
    printf '     npx netlify login\n'
    printf '     npx netlify deploy --prod\n\n'
    printf '   Before promoting to production, set these in the Netlify site env:\n'
    printf '     CARLTINE_INGEST_SECRET   (openssl rand -hex 32)\n'
    printf '     CARLTINE_D1_ACCOUNT_ID   (wrangler d1 create carltine)\n'
    printf '     CARLTINE_D1_DATABASE_ID\n'
    printf '     CARLTINE_CF_API_TOKEN    (D1:Edit token)\n'
    printf '     CARLTINE_API_KEYS        (otherwise the write API is open)\n\n'
    return 1
  fi

  npx netlify deploy --prod
  ok "published"
  printf '\n  Set the CARLTINE_* env vars listed in netlify.toml before going live.\n'
  printf '  Without D1 the ledger falls back to an ephemeral local file and resets\n'
  printf '  on every cold start, which /api/route treats as a reason to refuse.\n'
}

case "$TARGET" in
  build)   verify ;;
  github)  verify; deploy_github ;;
  netlify) verify; deploy_netlify || true ;;
  all)     verify; deploy_github; deploy_netlify || true ;;
  *)       die "unknown target: $TARGET (use build | github | netlify | all)" ;;
esac

printf '\n'
ok "done"
