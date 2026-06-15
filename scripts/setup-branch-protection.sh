#!/usr/bin/env bash
#
# One-shot branch-protection setup for `main`.
#
# Run from a workstation with `gh` authenticated as a repo admin:
#
#     ./scripts/setup-branch-protection.sh
#
# Closes the OpenSSF Scorecard `Branch-Protection` check. Re-runnable: the
# `PUT` call is idempotent — running it again overwrites the existing config
# with the same rules.

set -euo pipefail

REPO="${REPO:-Kwiket/jets-seatmap-angular-lib}"
BRANCH="${BRANCH:-main}"

echo "Applying branch protection to ${REPO}@${BRANCH}…"

gh api \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Unit tests",
      "Build library and demo",
      "Analyze (javascript-typescript)"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "required_linear_history": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON

echo "Done. Verify at: https://github.com/${REPO}/settings/branches"
