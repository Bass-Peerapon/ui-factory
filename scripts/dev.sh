#!/usr/bin/env bash
# Runs api, composer and web together with prefixed logs. Ctrl+C stops all three.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "missing .env (copy .env.example)"; exit 1; }
set -a; source .env; set +a

pids=()
run() {
  local name=$1 color=$2; shift 2
  ( "$@" 2>&1 | while IFS= read -r line; do printf "\033[%sm%-8s\033[0m %s\n" "$color" "$name" "$line"; done ) &
  pids+=($!)
}
cleanup() { trap - INT TERM EXIT; kill 0 2>/dev/null || true; }
trap cleanup INT TERM EXIT

run composer 35 pnpm --filter @ui-factory/composer dev
run api 36 bash -c "cd services/api && go run ./cmd/api"
run web 32 pnpm --filter @ui-factory/web dev
wait
