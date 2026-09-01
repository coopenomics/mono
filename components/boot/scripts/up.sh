#!/usr/bin/env bash
# Запуск стенда БЕЗ очистки: `pnpm run start`.
#
# Поднимает всё, что есть в компоузе, сохраняя данные — базы, цепь, учётки
# authentik остаются как были. Нужно, когда стенд просто выключен или часть
# сервисов упала: одна команда возвращает его целиком.
#
# Цепь здесь НЕ переразворачивается и контракты НЕ деплоятся — для этого
# `pnpm run reboot` (он же чистит данные).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/stack.sh
source "$SCRIPT_DIR/lib/stack.sh"

stack_load_env

echo "══ Запуск стенда ${STACK_PROJECT} (данные сохраняются) ══"

stack_up_infra
stack_up_authentik

echo "▸ Поднимаем цепь..."
docker compose up -d node

stack_up_app
stack_summary

echo "Стенд запущен."
