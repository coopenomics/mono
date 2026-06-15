#!/bin/bash

# Полный перезапуск dev-среды для теста Благороста одной командой:
#   1) extra_reboot.sh — чистая цепь + кооператив + совет 5 человек +
#      dev-shortcut онбординга capital (extensions.capital: все *_done=true);
#   2) ожидание готовности controller (GraphQL отвечает);
#   3) seed-capital до фазы $SEED_UP_TO (default 04-contributor): программы
#      УХД/Благорост + setconfig, проекты, регистрация ant как участника.
#
# Глубину сида можно менять: SEED_UP_TO=08-investments pnpm run reboot:blago

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

bash "$SCRIPT_DIR/extra_reboot.sh"

# Per-instance адрес controller'а — из корневого .env (API_URL); coopback после
# force-recreate поднимается десятки секунд, seed-фазы без него падают.
GRAPHQL_URL="${API_URL:-http://127.0.0.1:2998/v1/graphql}"
echo "Ждём готовности controller ($GRAPHQL_URL)..."
until curl -s --max-time 3 -o /dev/null -X POST -H 'Content-Type: application/json' \
  --data '{"query":"{__typename}"}' "$GRAPHQL_URL"; do
  sleep 3
done
echo "Controller готов."

UP_TO="${SEED_UP_TO:-04-contributor}"
echo "Сидируем capital до фазы $UP_TO..."
cd "$SCRIPT_DIR/.."
CONTROLLER_GRAPHQL_URL="$GRAPHQL_URL" pnpm exec esno src/scripts/seed-capital/index.ts --up-to="$UP_TO"

echo "Готово: среда Благорост поднята (seed до $UP_TO)."
