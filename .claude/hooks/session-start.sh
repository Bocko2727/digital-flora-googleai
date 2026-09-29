#!/bin/bash
# SessionStart hook: install the exact lockfile dependencies in Claude Code cloud
# sessions, which start without node_modules. Codespaces/local sessions are skipped
# (the devcontainer already runs `npm ci`).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# npm output goes to stderr so it does not land in the session context.
npm ci --no-audit --no-fund 1>&2
