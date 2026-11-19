#!/usr/bin/env bash
#
# ARSHNAZ release driver — one deploy command, one rollback command.
#
# How production is built: Vercel watches this repository through a GitHub App.
# A push to `main` is the only deploy trigger that exists here (no Vercel CLI is
# installed or logged in on this machine). So "deploy" means: commit exactly the
# allowlisted files, tag the app commit, and push `main`.
#
# Safe by default:
#   * nothing runs without --confirm;
#   * only allowlisted paths are committed — unrelated dirty work never ships;
#   * two commits, tooling first and the app change second, so rolling back the
#     app release cannot delete the runbook or this script;
#   * refuses to deploy when local `main` is not identical to `origin/main`;
#   * refuses to touch firestore.rules / storage.rules (rules are deployed
#     separately and deliberately, never as a side effect of a site release);
#   * refuses to roll back a commit that would revert a rules file.
#
# Usage:
#   scripts/release.sh status                 # where we are, what is pending
#   scripts/release.sh preview                # dry run: exact files and commands
#   scripts/release.sh check [--full]         # typecheck + tests only
#   scripts/release.sh deploy --confirm [--full] [--skip-checks] [--message "..."]
#   scripts/release.sh verify [<sha>]         # live /version.json vs a commit
#   scripts/release.sh rollback --confirm [--to <sha>]
#   scripts/release.sh rollback --confirm --instant
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
REPO_SLUG="${REPO_SLUG:-hamedharami-hub/arshiam1}"
LIVE_URL="${LIVE_URL:-https://arshnaz.vercel.app}"
ALLOWLIST="$ROOT/scripts/release-files.txt"
TOOLING="$ROOT/scripts/release-tooling.txt"
STATE_DIR="$ROOT/backups/releases"          # gitignored: local release ledger
TAG_PREFIX="${TAG_PREFIX:-release}"
RULES_FILES='^(firestore|storage)\.rules$'

# This machine has no git identity configured for the repo; keep releases
# attributable to the same author as the existing history.
GIT_ID=(git -c "user.name=${RELEASE_GIT_NAME:-Dragon}" -c "user.email=${RELEASE_GIT_EMAIL:-dragon@local}")

APP_MESSAGE_DEFAULT="fix(ux): make global search instant and keep folder quick-add and schedule day/time

- search: read the remote collections through the fast path instead of waiting
  up to 6s for a cold live listener (bug 1).
- quick add inside a folder: the floating "+" now writes the folder, goal,
  status and chosen day on its first save, and leaving the page no longer
  deletes the task that was just titled (bug 2, see docs/BUG2-VERDICT-FA.md).
- schedule: a repeat/reminder-only patch no longer replaces the schedule draft
  and wipes the day/time already chosen (bug 3).

Rules and database structure untouched. No unrelated work is included."

TOOLING_MESSAGE="chore(release): add the release runbook, allowlist and driver"

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
die()  { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
info() { printf '%s\n' "$*"; }
ok()   { printf 'OK   %s\n' "$*"; }
warn() { printf 'WARN %s\n' "$*"; }
hr()   { printf -- '------------------------------------------------------------------------\n'; }

need() { command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }

# Paths listed in a manifest, comments and blank lines dropped.
list_paths() {
  local file="$1"
  [ -f "$file" ] || die "missing manifest: ${file#$ROOT/}"
  grep -vE '^[[:space:]]*(#|$)' "$file" | tr -d '\r'
}
app_paths()     { list_paths "$ALLOWLIST"; }
tooling_paths() { list_paths "$TOOLING"; }

fetch_remote() { git fetch --quiet "$REMOTE" "$BRANCH" || die "git fetch $REMOTE $BRANCH failed"; }
head_sha()   { git rev-parse --short HEAD; }
remote_sha() { git rev-parse --short "$REMOTE/$BRANCH"; }

live_commit() {
  command -v curl >/dev/null 2>&1 || return 0
  command -v jq   >/dev/null 2>&1 || return 0
  curl -fsS --max-time 20 "$LIVE_URL/version.json" 2>/dev/null | jq -r '.commit // empty' 2>/dev/null || true
}

path_changed() { [ -n "$(git status --porcelain -- "$1")" ]; }
group_changed() { list_paths "$1" | while IFS= read -r p; do path_changed "$p" && { echo yes; break; }; done; }

# Listed paths that exist and are actually changed (tooling may move partially).
changed_in_manifest() {
  local file="$1" path
  while IFS= read -r path; do
    [ -e "$path" ] || die "listed file does not exist: $path (${file#$ROOT/})"
    path_changed "$path" && printf '%s\n' "$path"
  done < <(list_paths "$file")
}

assert_on_branch() {
  local current; current="$(git rev-parse --abbrev-ref HEAD)"
  [ "$current" = "$BRANCH" ] || die "on branch '$current', releases must run on '$BRANCH'"
}

assert_synced_with_remote() {
  fetch_remote
  local l r; l="$(head_sha)"; r="$(remote_sha)"
  if [ "$l" != "$r" ]; then
    git --no-pager log --oneline "$REMOTE/$BRANCH..HEAD" "HEAD..$REMOTE/$BRANCH" 2>/dev/null | head -20 || true
    die "local $BRANCH ($l) is not identical to $REMOTE/$BRANCH ($r). Push or pull first."
  fi
}

assert_no_staged_changes() {
  if ! git diff --cached --quiet; then
    git --no-pager diff --cached --name-status
    die "index already has staged changes. Stage nothing by hand; the script stages the manifests itself."
  fi
}

# Every path in a manifest must exist and must actually be changed.
assert_manifest_changed() {
  local file="$1" path bad=0
  while IFS= read -r path; do
    if [ ! -e "$path" ]; then warn "listed file does not exist: $path"; bad=1; continue; fi
    if ! path_changed "$path"; then warn "listed file has no change: $path"; bad=1; fi
  done < <(list_paths "$file")
  [ "$bad" -eq 0 ] || die "${file#$ROOT/} does not match the working tree; refusing a partial release."
}

assert_rules_untouched() {
  local changed; changed="$(git status --porcelain -- firestore.rules storage.rules || true)"
  [ -z "$changed" ] || die "firestore.rules/storage.rules are modified. Rules never ship with a site release; revert or stash them first."
}

print_pending_split() {
  local tooling_list; tooling_list="$(mktemp)"
  tooling_paths > "$tooling_list"
  hr
  info "WILL SHIP — app commit (scripts/release-files.txt):"
  local path
  while IFS= read -r path; do
    if path_changed "$path"; then printf '  M %s\n' "$path"; else printf '  - %s (unchanged)\n' "$path"; fi
  done < <(app_paths)
  info "WILL SHIP — tooling commit (scripts/release-tooling.txt):"
  while IFS= read -r path; do
    if path_changed "$path"; then printf '  M %s\n' "$path"; else printf '  - %s (unchanged)\n' "$path"; fi
  done < "$tooling_list"
  hr
  info "WILL NOT SHIP (left dirty in the working tree, untouched):"
  local any=0 entry
  while IFS= read -r entry; do
    [ -n "$entry" ] || continue
    path="${entry:3}"
    if ! app_paths | grep -qxF "$path" && ! grep -qxF "$path" "$tooling_list"; then
      printf '  %s\n' "$entry"; any=1
    fi
  done < <(git status --porcelain)
  [ "$any" -eq 1 ] || printf '  (nothing else is dirty)\n'
  rm -f "$tooling_list"
}

record_state() {
  local kind="$1" sha="$2" previous="$3" message="$4"
  mkdir -p "$STATE_DIR"
  local file="$STATE_DIR/$(date -u +%Y%m%dT%H%M%SZ)-$kind.json"
  jq -n --arg kind "$kind" --arg sha "$sha" --arg previous "$previous" \
        --arg message "$message" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg by "$(whoami)@$(hostname)" \
        '{kind:$kind, sha:$sha, previous:$previous, message:$message, at:$at, by:$by}' > "$file"
  ok "release ledger: ${file#$ROOT/}"
}

# Stage exactly the changed paths of one manifest and prove the index equals them.
stage_group() {
  local file="$1" path staged expected tmp
  tmp="$(mktemp)"
  changed_in_manifest "$file" > "$tmp"
  while IFS= read -r path; do git add -- "$path"; done < "$tmp"
  staged="$(git diff --cached --name-only | sort)"
  expected="$(sort "$tmp")"
  rm -f "$tmp"
  if [ "$staged" != "$expected" ]; then
    printf '%s\n' "$staged" >&2
    git reset --quiet -- .
    die "staged set does not equal ${file#$ROOT/}; index reset, nothing committed."
  fi
  ok "staged exactly: $(printf '%s' "$staged" | tr '\n' ' ')"
}

# ---------------------------------------------------------------------------
# status / preview / check
# ---------------------------------------------------------------------------
cmd_status() {
  need git
  assert_on_branch
  fetch_remote
  local live; live="$(live_commit)"
  hr
  printf 'branch        : %s\n' "$(git rev-parse --abbrev-ref HEAD)"
  printf 'local HEAD    : %s  %s\n' "$(head_sha)" "$(git log -1 --pretty=%s)"
  printf 'origin/main   : %s\n' "$(remote_sha)"
  printf 'live version  : %s\n' "${live:-<unavailable>}"
  [ -n "$live" ] && { [ "$live" = "$(head_sha)" ] && ok "live commit equals local HEAD" || warn "live commit differs from local HEAD"; }
  hr
  print_pending_split
  hr
  printf 'last release tag: %s\n' "$(git tag --list "${TAG_PREFIX}-*" --sort=-creatordate | head -1 || true)"
}

cmd_preview() {
  need git
  assert_on_branch
  print_pending_split
  hr
  assert_manifest_changed "$ALLOWLIST"
  assert_rules_untouched
  ok "app manifest matches the working tree"
  if [ -n "$(group_changed "$TOOLING")" ]; then changed_in_manifest "$TOOLING" >/dev/null; ok "tooling manifest matches the working tree"; else info "tooling is already committed; no tooling commit will be made"; fi
  hr
  info "deploy would run, in order:"
  cat <<'EOS'
  1) git fetch origin main && require local main == origin/main
  2) npm run typecheck                     (frontend)
  3) npx vitest run <changed test files>   (--full runs the whole suite + api)
  4) tooling commit  (only if scripts/release-tooling.txt changed)
  5) app commit      (exactly scripts/release-files.txt)
  6) git tag release-<UTC timestamp>       (on the app commit)
  7) git push origin main && git push origin <tag>
EOS
  hr
  info "nothing was changed by this preview."
}

run_targeted_tests() {
  local tests=() path
  while IFS= read -r path; do
    case "$path" in *.test.ts|*.test.tsx) tests+=("$path") ;; esac
  done < <(app_paths)
  if [ "${#tests[@]}" -eq 0 ]; then warn "no test files in the app manifest"; return 0; fi
  ( cd frontend && npx vitest run "${tests[@]#frontend/}" )
}

cmd_check() {
  local full=0 arg
  for arg in "$@"; do [ "$arg" = "--full" ] && full=1; done
  hr; info "typecheck"
  ( cd frontend && npm run typecheck )
  hr; info "targeted tests"
  run_targeted_tests
  if [ "$full" -eq 1 ]; then
    hr; info "full frontend suite"
    ( cd frontend && npx vitest run )
    hr; info "api suite"
    ( cd frontend && npm run test:api )
  fi
  hr; ok "checks passed"
}

# ---------------------------------------------------------------------------
# deploy
# ---------------------------------------------------------------------------
cmd_deploy() {
  local confirm=0 full=0 skip=0 message="$APP_MESSAGE_DEFAULT"
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --confirm) confirm=1 ;;
      --full) full=1 ;;
      --skip-checks) skip=1 ;;
      --message) shift; [ "$#" -gt 0 ] || die "--message needs a value"; message="$1" ;;
      *) die "unknown deploy flag: $1" ;;
    esac
    shift
  done
  [ "$confirm" -eq 1 ] || die "deploy needs --confirm (see: scripts/release.sh preview)"

  need git; need jq
  assert_on_branch
  assert_synced_with_remote
  assert_no_staged_changes
  assert_rules_untouched
  assert_manifest_changed "$ALLOWLIST"
  local tooling_dirty=0
  [ -n "$(group_changed "$TOOLING")" ] && tooling_dirty=1
  if [ "$tooling_dirty" -eq 1 ]; then changed_in_manifest "$TOOLING" >/dev/null; fi
  print_pending_split

  if [ "$skip" -eq 1 ]; then warn "--skip-checks: no test will run before this release"
  elif [ "$full" -eq 1 ]; then cmd_check --full
  else cmd_check; fi

  local previous; previous="$(head_sha)"

  if [ "$tooling_dirty" -eq 1 ]; then
    stage_group "$TOOLING"
    "${GIT_ID[@]}" commit --quiet -m "$TOOLING_MESSAGE"
    ok "tooling commit $(head_sha)"
  fi

  stage_group "$ALLOWLIST"
  "${GIT_ID[@]}" commit --quiet -m "$message"
  local sha short tag
  sha="$(git rev-parse HEAD)"; short="$(git rev-parse --short HEAD)"
  tag="${TAG_PREFIX}-$(date -u +%Y%m%d-%H%M%S)"
  git tag -a "$tag" -m "ARSHNAZ release $tag" "$sha"
  ok "app commit $short ($tag); main was $previous"

  git push --quiet "$REMOTE" "$BRANCH" || die "push of $BRANCH failed; the commits exist locally only"
  git push --quiet "$REMOTE" "$tag" || warn "tag $tag was not pushed (the site release itself already went through)"
  ok "pushed $BRANCH and $tag"

  record_state deploy "$sha" "$previous" "$(printf '%s' "$message" | head -1)"

  hr
  cat <<EOS
Vercel is building automatically. Test the result, do not assume it:
  scripts/release.sh verify            # live /version.json must report $short
  gh api repos/$REPO_SLUG/commits/$sha/status

If the build is red, production keeps serving the previous deployment and there
is nothing to undo. If it is green but the behaviour is wrong:
  scripts/release.sh rollback --confirm
EOS
}

# ---------------------------------------------------------------------------
# verify
# ---------------------------------------------------------------------------
cmd_verify() {
  local expected="${1:-}"
  [ -n "$expected" ] || expected="$(head_sha)"
  expected="${expected:0:7}"
  local live; live="$(live_commit)"
  [ -n "$live" ] || die "could not read $LIVE_URL/version.json"
  printf 'expected (commit)  : %s\nlive (/version.json): %s\n' "$expected" "$live"
  if [ "$live" = "$expected" ]; then ok "the live site reports the expected commit"; return 0; fi
  warn "live site does not report $expected yet (build running, or another commit is live)"
  return 1
}

# ---------------------------------------------------------------------------
# rollback
# ---------------------------------------------------------------------------
cmd_rollback() {
  local confirm=0 to="" instant=0
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --confirm) confirm=1 ;;
      --to) shift; [ "$#" -gt 0 ] || die "--to needs a commit"; to="$1" ;;
      --instant) instant=1 ;;
      *) die "unknown rollback flag: $1" ;;
    esac
    shift
  done
  [ "$confirm" -eq 1 ] || die "rollback needs --confirm (see: scripts/release.sh status)"

  if [ "$instant" -eq 1 ]; then
    info "Vercel instant rollback (no rebuild, switches the production alias):"
    info "  1. open https://vercel.com/$REPO_SLUG/deployments"
    info "  2. find the deployment of the last known-good commit"
    info "  3. ... > Promote to Production"
    if [ -n "${VERCEL_TOKEN:-}" ] && [ -n "${VERCEL_PROJECT_ID:-}" ]; then
      info "VERCEL_TOKEN and VERCEL_PROJECT_ID are set; that path can be scripted here."
    else
      die "instant rollback needs a Vercel session or token; nothing was changed. Use the git rollback: scripts/release.sh rollback --confirm"
    fi
    return 0
  fi

  need git; need jq
  assert_on_branch
  assert_synced_with_remote

  local target previous
  if [ -n "$to" ]; then
    git rev-parse --verify --quiet "$to^{commit}" >/dev/null || die "unknown commit: $to"
    target="$to..HEAD"
    local count; count="$(git rev-list --count "$target")"
    [ "$count" -gt 0 ] || die "nothing to revert: HEAD is already $to"
    info "reverting $count commit(s) between $to and HEAD"
  else
    target="HEAD"
    info "reverting the newest commit on $BRANCH: $(git log -1 --pretty='%h %s')"
  fi
  previous="$(head_sha)"

  if ! "${GIT_ID[@]}" revert --no-edit "$target"; then
    git revert --abort 2>/dev/null || true
    die "revert hit a conflict; nothing was pushed (working tree restored). Resolve by hand or use a smaller range with --to."
  fi

  # A site rollback must never move the security rules.
  if git diff --name-only "$previous" HEAD | grep -qE "$RULES_FILES"; then
    git reset --hard --quiet "$previous"
    die "this rollback would change firestore.rules/storage.rules; aborted and reset. Rules are not part of a site rollback."
  fi

  local short; short="$(git rev-parse --short HEAD)"
  git push --quiet "$REMOTE" "$BRANCH" || die "rollback commit exists locally but the push failed"
  ok "rolled back by $short and pushed to $BRANCH"
  record_state rollback "$(git rev-parse HEAD)" "$previous" "rollback of $previous"
  hr
  info "Vercel rebuilds from the reverted source; confirm with: scripts/release.sh verify $short"
}

usage() {
  cat <<'EOS'
ARSHNAZ release driver — deploy and rollback on this repository's real pipeline.

  scripts/release.sh status                 where we are, what is pending
  scripts/release.sh preview                dry run: exact files and commands
  scripts/release.sh check [--full]         typecheck + tests only
  scripts/release.sh deploy --confirm [--full] [--skip-checks] [--message "..."]
  scripts/release.sh verify [<sha>]         live /version.json vs a commit
  scripts/release.sh rollback --confirm [--to <sha>]
  scripts/release.sh rollback --confirm --instant

Deploy commits exactly the paths in scripts/release-files.txt (app) plus, when
they changed, scripts/release-tooling.txt (runbook and this script, in an earlier
commit), tags the app commit, and pushes main; Vercel's GitHub App builds it.
Rollback reverts the newest commit, or the range down to --to, and pushes. Rules
files are never part of either path.
EOS
}

main() {
  local cmd="${1:-help}"; shift || true
  case "$cmd" in
    status)   cmd_status "$@" ;;
    preview)  cmd_preview "$@" ;;
    check)    cmd_check "$@" ;;
    deploy)   cmd_deploy "$@" ;;
    verify)   cmd_verify "$@" ;;
    rollback) cmd_rollback "$@" ;;
    help|-h|--help) usage ;;
    *) die "unknown command: $cmd (try: help)" ;;
  esac
}

main "$@"
