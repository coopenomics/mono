#!/usr/bin/env bash
# Остановка стенда без потери данных: `pnpm run stop`.
#
# Гасит все сервисы компоуза. Тома и данные цепи не трогает — `pnpm run start`
# вернёт стенд в том же состоянии. Полная очистка — только `pnpm run reboot`.
#
# Сеть компоуза намеренно не сносим (`stop`, а не `down`): к ней может быть
# подключён внешний контейнер, и тогда снос сети падает с ошибкой.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/stack.sh
source "$SCRIPT_DIR/lib/stack.sh"

stack_load_env

echo "══ Останавливаем стенд ${STACK_PROJECT} ══"
docker compose stop
echo "Стенд остановлен. Запустить обратно: pnpm run start"
