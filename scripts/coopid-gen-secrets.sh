#!/usr/bin/env bash
# Генерация file-based Docker Secrets для CoopID-стека (dev).
# Идемпотентен: существующие непустые файлы не перезаписывает.
# На prod секреты раскладывает плейбук — этот скрипт только для локальной разработки.
set -euo pipefail

command -v openssl >/dev/null || { echo "Нужен openssl (генерация ключей/паролей)"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS_DIR="$ROOT/infra/coopid/secrets"
mkdir -p "$SECRETS_DIR"

gen() {
	local mode="$1" name="$2"
	shift 2
	local file="$SECRETS_DIR/$name"
	if [[ -s "$file" ]]; then
		echo "  = $name — уже существует, пропущен"
		return
	fi
	"$@" > "$file"
	chmod "$mode" "$file"
	echo "  + $name — создан"
}

rand_hex() { openssl rand -hex 32; }
rand_pass() { openssl rand -base64 36 | tr -d '\n=/+'; }
secp256k1_pem() { openssl ecparam -genkey -name secp256k1 -noout; }

echo "Секреты CoopID → $SECRETS_DIR"
# Ключ подписи participant_certificate (ES256K, secp256k1).
gen 0400 coop_cert_key secp256k1_pem
# AES-ключ vault'а кооператива (subject_type='coop').
gen 0400 coop_vault_key rand_hex
# authentik: secret key + bootstrap-учётка akadmin (образ работает под uid 1000 = владелец файлов).
gen 0400 authentik_secret_key rand_pass
gen 0400 authentik_bootstrap_password rand_pass
gen 0400 authentik_bootstrap_token rand_pass
# Shared-токен вебхука authentik → controller (audit weak-password, Story 1.5).
# Дублируется в .env (COOPID_WEBHOOK_TOKEN) для blueprint'а authentik.
gen 0400 authentik_webhook_token rand_pass
# Секрет подписи session_binding_token (HS256, Story 1.6).
gen 0400 auth_v2_session_binding_secret rand_pass
# Секрет confidential-клиента card.coop (карта пайщика, Story 7.0). Живёт в .env,
# потому что его читает blueprint authentik (CARDCOOP_CLIENT_SECRET), а blueprint'ы
# видят только окружение — file:// они не понимают. Тот же секрет оператор сети
# передаёт в реестр АНО при активации кооператива (FR-E6).
gen 0400 cardcoop_client_secret rand_pass
if ! grep -q '^CARDCOOP_CLIENT_SECRET=' "$ROOT/.env" 2>/dev/null; then
	printf '\n# Секрет клиента card.coop в CoopID (= infra/coopid/secrets/cardcoop_client_secret)\nCARDCOOP_CLIENT_SECRET=%s\n' "$(cat "$SECRETS_DIR/cardcoop_client_secret")" >> "$ROOT/.env"
	echo "  + CARDCOOP_CLIENT_SECRET добавлен в .env"
fi
if ! grep -q '^COOPID_WEBHOOK_TOKEN=' "$ROOT/.env" 2>/dev/null; then
	printf '\n# Webhook-токен authentik→coopback (= infra/coopid/secrets/authentik_webhook_token)\nCOOPID_WEBHOOK_TOKEN=%s\n' "$(cat "$SECRETS_DIR/authentik_webhook_token")" >> "$ROOT/.env"
	echo "  + COOPID_WEBHOOK_TOKEN добавлен в .env"
fi
# postgres: пароли прикладных ролей CoopID (authentik_user, coop_app_user).
# Суперюзер postgres использует inline-пароль из docker-compose.yaml — отдельный
# секрет ему не нужен. file-секреты в plain compose монтируются bind-mount'ом с
# хостовыми правами, а init-скрипты официального образа выполняются под uid 999
# (postgres) — поэтому пароли world-readable. Только dev; prod-права (0400) — плейбук.
gen 0444 coop_pg_authentik_password rand_pass
gen 0444 coop_pg_app_password rand_pass

echo "Готово. Дальше: docker compose up -d (весь стек одной командой)."
