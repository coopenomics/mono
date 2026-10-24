#!/usr/bin/env bash
# Ведущий кооператив связки двух локальных стендов (487-34):
#   pnpm run reboot:extra2coop:master
#
# Ведущий — кооператив-оператор voskhod с цепью, провайдером и каталогом
# приложений. Скрипт:
#   1. Проверяет, что провайдер считает partner1 собственной установкой
#      (SELF_HOSTED_COOPS) — иначе провайдер закажет ему сервер в Hostkey.
#   2. Перезапускает стенд с расширенным наполнением (extra_reboot.sh): цепь,
#      контракты, совет и кооператив partner1 в цепи.
#   3. Сбрасывает у провайдера и в каталоге всё, что осталось от partner1
#      прошлой жизни цепи: подписки, платежи, счета, инстанс. Цепь новая —
#      старые записи ссылаются на то, чего в ней нет, а флаг стартовых
#      переводов не дал бы новому аккаунту получить AXON.
#
# Дальше — ведомый в другом чекауте: `pnpm run reboot:extra2coop:slave`.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/stack.sh
source "$SCRIPT_DIR/lib/stack.sh"
stack_load_env

PROVIDER_DIR="${PROVIDER_DIR:-$HOME/provider}"
SLAVE_COOPNAME="${SLAVE_COOPNAME:-partner1}"
PROVIDER_ENV="$PROVIDER_DIR/.env.dev-stack"

provider_env() { grep -E "^$1=" "$PROVIDER_ENV" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'; }
if ! provider_env SELF_HOSTED_COOPS | tr ',' '\n' | grep -qx "$SLAVE_COOPNAME"; then
  echo "✗ Провайдер не знает, что $SLAVE_COOPNAME работает на соседнем стенде: закажет ему сервер в Hostkey."
  echo "  Добавь в $PROVIDER_ENV строку SELF_HOSTED_COOPS=$SLAVE_COOPNAME и перезапусти провайдер: (cd $PROVIDER_DIR && pnpm dev:stack)"
  exit 1
fi
for key in CATALOG_OPERATOR_URL CATALOG_PROVIDER_KEY; do
  [ -n "$(provider_env "$key")" ] || echo "  ⚠ у провайдера не задан $key — подписки на приложения не попадут в каталог"
done

echo "══ Ведущий кооператив связки: ${STACK_PROJECT} ══"
# EXTRA_RENT=1 — boot заводит partner1 кооперативом в цепи (regcoop, активный
# статус), а не кандидатом: провайдер подхватывает его синком и подключает узел.
EXTRA_RENT=1 bash "$SCRIPT_DIR/extra_reboot.sh" || exit 1

echo "▸ Разрешение voskhod@provider: им провайдер подписывает канал оператора каталога..."
(cd "$STACK_ROOT/components/boot" && \
  CATALOG_PROVIDER_KEY="$(provider_env CATALOG_PROVIDER_KEY)" pnpm exec esno src/two-coop/provider-permission.ts) \
  || echo "  ⚠ разрешение не опубликовано — каталог не примет кооперативы и подписки от провайдера"

echo "▸ Сбрасываем у провайдера и в каталоге состояние $SLAVE_COOPNAME прошлой цепи..."
# Провайдер на время очистки остановлен: синк с цепью раз в минуту успел бы
# пересоздать инстанс со старыми флагами между удалениями.
docker stop provider-backend >/dev/null 2>&1 || true
docker exec -i postgres-provider psql -U provider -d provider -v ON_ERROR_STOP=1 -v coop="$SLAVE_COOPNAME" <<'SQL'
BEGIN;
DELETE FROM payments WHERE subscription_id IN (
  SELECT s.id FROM subscriptions s JOIN subscribers b ON b.id = s.subscriber_id WHERE b.username = :'coop');
DELETE FROM billing_invoice WHERE coopname = :'coop';
DELETE FROM subscriptions WHERE subscriber_id IN (SELECT id FROM subscribers WHERE username = :'coop');
DELETE FROM instance WHERE username = :'coop';
COMMIT;
SQL
docker exec -i apps-catalog-postgres sh -c "psql -U \"\$POSTGRES_USER\" -d catalog_operator -v ON_ERROR_STOP=1" <<SQL || echo "  ⚠ каталог не очищен (контейнер apps-catalog-postgres не найден?)"
DELETE FROM subscriptions WHERE coopname = '$SLAVE_COOPNAME';
DELETE FROM coops WHERE coopname = '$SLAVE_COOPNAME';
SQL
docker start provider-backend >/dev/null

echo
echo "── Ведущий готов ────────────────────────────────────────────────"
echo "  Дальше ведомый кооператив $SLAVE_COOPNAME — в ДРУГОМ чекауте:"
echo "    cd <чекаут ведомого> && MASTER_DIR=$STACK_ROOT pnpm run reboot:extra2coop:slave"
echo "─────────────────────────────────────────────────────────────────"
