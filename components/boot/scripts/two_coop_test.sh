#!/usr/bin/env bash
# Сценарий полного пути на связке двух кооперативов (487-34):
#   pnpm run test:two-coop                      (ведомый — ../mono-ai-4)
#   SLAVE_DIR=../mono-ai-1 pnpm run test:two-coop
#
# Запускается в чекауте ведущего после reboot:extra2coop. Читает порты обоих
# стендов из их .env и передаёт тесту адреса: цепь и GraphQL ведущего,
# оркестратор ведомого. Тест — components/boot/src/tests/catalog-apps-two-coop.test.ts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/stack.sh
source "$SCRIPT_DIR/lib/stack.sh"
stack_load_env

SLAVE_DIR="$(cd "${SLAVE_DIR:-$STACK_ROOT/../mono-ai-4}" && pwd)"
slave_env() { grep -E "^$1=" "$SLAVE_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2-; }

export CHAIN_URL="${CHAIN_URL:-http://127.0.0.1:${NODE_HTTP_PORT:-8888}}"
# localhost, а не 127.0.0.1: nginx стенда переадресует 127.0.0.1 на localhost.
export API_URL="${API_URL:-http://localhost:${NGINX_HOST_PORT:-8108}/backend/v1/graphql}"
SLAVE_ORCH_PORT="$(slave_env ORCHESTRATOR_HOST_PORT)"
export SLAVE_ORCHESTRATOR_URL="${SLAVE_ORCHESTRATOR_URL:-http://127.0.0.1:${SLAVE_ORCH_PORT:-4000}}"
export SERVER_SECRET="${SERVER_SECRET:-$(grep -E '^SERVER_SECRET=' "$STACK_ROOT/components/controller/.env" | tail -1 | cut -d= -f2-)}"

echo "▸ цепь $CHAIN_URL · GraphQL $API_URL · оркестратор ведомого $SLAVE_ORCHESTRATOR_URL"
cd "$STACK_ROOT/components/boot" && \
  exec pnpm exec vitest run src/tests/catalog-apps-two-coop.test.ts --testTimeout=600000 "$@"
