#!/usr/bin/env bash
# Переносит bootstrap-секреты authentik из файлов в корневой .env.
#
# Зачем это вообще нужно. Почти все переменные authentik идут через его загрузчик
# конфига и понимают префикс `file://` — так и заданы в компоузе. Но
# AUTHENTIK_BOOTSTRAP_PASSWORD и AUTHENTIK_BOOTSTRAP_TOKEN читаются напрямую из
# окружения, минуя загрузчик, и берут строку буквально. Пока в компоузе стояло
# `file:///run/secrets/authentik_bootstrap_token`, админ-токеном authentik'а
# становилась сама эта строка: контроллер получал 403, а миграция «ключ→пароль»
# падала с 500. Диагностируется отвратительно — в базе лежит «токен» длиной ровно
# в длину пути.
#
# Поэтому источником истины остаются файлы в infra/coopid/secrets, а этот скрипт
# кладёт их значения в .env, откуда компоуз подставляет их напрямую. Запускать
# после смены секретов; идемпотентен.
#
# ВАЖНО: bootstrap-значения применяются authentik'ом ТОЛЬКО при первой инициализации
# его базы. Если authentik уже поднимался со старыми значениями, одной правки .env
# мало — нужно пересоздать authentik_db (см. README infra/coopid).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SECRETS_DIR="$ROOT_DIR/infra/coopid/secrets"
ENV_FILE="$ROOT_DIR/.env"

set_env_var() {
  local name="$1" value="$2"
  if grep -q "^${name}=" "$ENV_FILE" 2>/dev/null; then
    # Значение подставляем через переменную окружения awk, чтобы не мучиться с
    # экранированием спецсимволов секрета в sed-выражении.
    NEW_VALUE="$value" awk -v n="$name" \
      'BEGIN{FS=OFS="="} $1==n {print n "=" ENVIRON["NEW_VALUE"]; next} {print}' \
      "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$name" "$value" >> "$ENV_FILE"
  fi
  echo "  ✅ $name перенесён в .env"
}

# COOPID_WEBHOOK_TOKEN живёт в двух местах: файл секрета читает контроллер, а
# значение из .env подставляется в blueprint authentik. Генератор секретов дописывает
# переменную в .env только если её там ещё нет, поэтому «старый .env + свежий файл
# секрета» расходятся молча, а наружу это выходит как 403 на вебхуке. Синхронизируем
# так же, как bootstrap-значения: истина — файл.
for pair in "AUTHENTIK_BOOTSTRAP_PASSWORD:authentik_bootstrap_password" \
            "AUTHENTIK_BOOTSTRAP_TOKEN:authentik_bootstrap_token" \
            "COOPID_WEBHOOK_TOKEN:authentik_webhook_token"; do
  var="${pair%%:*}"
  file="$SECRETS_DIR/${pair##*:}"
  if [ ! -r "$file" ]; then
    echo "  ⚠ нет файла секрета $file — пропускаю $var"
    continue
  fi
  set_env_var "$var" "$(tr -d '\r\n' < "$file")"
done

echo "Готово. Значения не печатаются намеренно."
