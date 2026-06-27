#!/usr/bin/env bash
# Start Next.js dev server with .env.test (local Supabase) for e2e tests.
set -euo pipefail
cd "$(dirname "$0")/.."
exec env $(grep -v '^#' .env.test | xargs) node_modules/.bin/next dev --webpack
