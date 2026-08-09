#!/usr/bin/env bash
# Чистый перезапуск стенда с расширенным наполнением: `pnpm run reboot:extra`.
#
# То же, что reboot, но boot:extra (совет и пайщики; partner1 при EXTRA_RENT=1)
# и досев ПВЗ Подмосковья для сценариев Стола заказов. Стенд поднимается целиком,
# включая authentik, рабочий стол и единый вход — общие шаги в lib/stack.sh.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/stack.sh
source "$SCRIPT_DIR/lib/stack.sh"

stack_load_env

echo "══ Чистый перезапуск стенда ${STACK_PROJECT} (расширенное наполнение) ══"

stack_wipe_all
stack_up_infra
stack_up_authentik

echo "▸ Запускаем boot:extra: цепь, контракты, совет и пайщики..."
pnpm run boot:extra

stack_up_app

# Таблицы marketplace создаёт контроллер при старте (TypeORM synchronize).
# Без досева таблица ПВЗ пуста, селект в интерфейсе приходит пустым, и
# harness-сценарии Стола заказов падают на ровном месте. Сидер идемпотентен.
echo "▸ Ждём создания marketplace_ku_details контроллером..."
if stack_wait_for "таблица ПВЗ" 60 2 \
  bash -c 'docker compose exec -T postgres psql -U "${POSTGRES_USERNAME:-postgres}" -d "${POSTGRES_DATABASE:-voskhod}" -tAc "SELECT to_regclass('"'"'public.marketplace_ku_details'"'"')" 2>/dev/null | grep -q marketplace_ku_details'
then
  echo "▸ Засеваем 3 ПВЗ Подмосковья (krg/odn/myt)..."
  pnpm run seed:marketplace-ku || echo "  ⚠ сид ПВЗ не выполнен (для остального стенда не критично)"
else
  echo "  ⚠ таблица ПВЗ не появилась — сид пропущен"
fi

stack_summary

echo "Перезапуск завершён."
