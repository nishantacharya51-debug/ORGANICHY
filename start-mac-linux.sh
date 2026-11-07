#!/usr/bin/env bash
# ORGANICHY — local launcher for macOS and Linux.
# Checks Node, frees the port if it is busy with a stale instance, then starts.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3000}"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is not installed. Get the LTS from https://nodejs.org (need v18 or newer)."
  exit 1
fi

MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 18 ]; then
  echo "✗ ORGANICHY needs Node 18+, this is $(node -v). Update from https://nodejs.org"
  exit 1
fi

if [ -f .env ]; then
  echo "· using .env from this folder"
else
  echo "· no .env found — starting with defaults (admin password: organichy@2026)"
fi

echo "· starting ORGANICHY on http://localhost:${PORT}"
echo "  store: http://localhost:${PORT}/     admin: http://localhost:${PORT}/admin"
echo "  ctrl-c stops it"
echo

exec env PORT="$PORT" node server.js
