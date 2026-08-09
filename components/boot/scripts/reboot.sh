#!/usr/bin/env bash
# Чистый перезапуск ВСЕГО стенда одной командой: `pnpm run reboot`.
#
# Полная очистка (контейнеры, тома баз, данные цепи) и подъём всего, что есть в
# компоузе: базы, файловое хранилище, authentik, цепь с контрактами, парсер,
# бэкенд, рабочий стол и единый вход nginx. Руками доподнимать ничего не нужно.
#
# Нужен собранный код: `pnpm run build:lib` и `pnpm run build:contracts:all:test`
# (boot деплоит в цепь именно собранные wasm — без них подъём осмысленно не пройдёт).
#
# Варианты: reboot:clean (без очистки томов), reboot:extra (совет и пайщики),
# reboot:blago (extra + сид Благороста). Общие шаги — в lib/stack.sh.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/stack.sh
source "$SCRIPT_DIR/lib/stack.sh"

stack_load_env

echo "══ Чистый перезапуск стенда ${STACK_PROJECT} ══"

stack_wipe_all
stack_up_infra
stack_up_authentik

echo "▸ Запускаем boot: поднимаем цепь и деплоим контракты..."
pnpm run boot

stack_up_app
stack_summary

echo "Перезапуск завершён."
