#!/usr/bin/env bash
# CoopID daily backup (Story 9.8): pg_basebackup всего PG-кластера (authentik_db +
# coop_domain_db + любые прочие БД внутри контейнера) → один gzip-tar → S3
# `s3://{bucket}/{coopname}/{YYYY-MM-DD}.tar.gz` с SSE-S3. На каждый прогон —
# строка audit_events (coopid.backup.created). Retention 30 дней — S3 lifecycle
# rule (ставится один раз режимом `--setup`), НЕ ручным удалением.
#
# Один скрипт для dev (MinIO) и prod (реальный S3): endpoint и креды — из env.
# Cron 03:00 UTC ставит прод-плейбук (~/playbooks); crontab-строка — в README.
#
# Использование:
#   COOPNAME=voskhod ./coopid-backup.sh            # сделать бэкап
#   COOPNAME=voskhod ./coopid-backup.sh --setup    # создать bucket + lifecycle 30d
#   COOPNAME=voskhod ./coopid-backup.sh --dry-run  # показать команды, не выполнять
#
# Обязательные env: COOPNAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
# Опциональные env (со значениями по умолчанию ниже):
#   S3_BUCKET (coopid-backups), S3_ENDPOINT (пусто=реальный AWS S3),
#   RETENTION_DAYS (30), PG_CONTAINER (coop-postgres), PG_SUPERUSER (postgres),
#   COOP_DOMAIN_DB (coop_domain_db), S3_SSE (AES256), AWS_DEFAULT_REGION (us-east-1).
set -euo pipefail

COOPNAME="${COOPNAME:?COOPNAME обязателен (имя кооператива)}"
S3_BUCKET="${S3_BUCKET:-coopid-backups}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
PG_CONTAINER="${PG_CONTAINER:-coop-postgres}"
PG_SUPERUSER="${PG_SUPERUSER:-postgres}"
COOP_DOMAIN_DB="${COOP_DOMAIN_DB:-coop_domain_db}"
S3_SSE="${S3_SSE:-AES256}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

MODE="backup"
case "${1:-}" in
  --setup) MODE="setup" ;;
  --dry-run) MODE="dry-run" ;;
  "") MODE="backup" ;;
  *) echo "Неизвестный аргумент: $1 (ожидается --setup | --dry-run)" >&2; exit 2 ;;
esac

# aws CLI с опциональным endpoint (MinIO в dev / реальный S3 в prod).
aws_s3() {
  if [[ -n "$S3_ENDPOINT" ]]; then aws --endpoint-url "$S3_ENDPOINT" "$@"; else aws "$@"; fi
}

log() { echo "[coopid-backup] $*"; }

# --- режим --setup: bucket + lifecycle (retention 30 дней) ---
setup_bucket() {
  log "ensure bucket s3://$S3_BUCKET"
  if ! aws_s3 s3api head-bucket --bucket "$S3_BUCKET" >/dev/null 2>&1; then
    aws_s3 s3 mb "s3://$S3_BUCKET"
  fi
  log "apply lifecycle: expire objects after ${RETENTION_DAYS}d"
  aws_s3 s3api put-bucket-lifecycle-configuration \
    --bucket "$S3_BUCKET" \
    --lifecycle-configuration "{
      \"Rules\": [{
        \"ID\": \"coopid-backups-retention-${RETENTION_DAYS}d\",
        \"Status\": \"Enabled\",
        \"Filter\": { \"Prefix\": \"\" },
        \"Expiration\": { \"Days\": ${RETENTION_DAYS} }
      }]
    }"
  log "setup завершён"
}

# --- запись результата в append-only audit_events (coop_domain_db) ---
# Значения подставляются через psql-переменные с квотированием :'var' — не
# попадают в текст команды и безопасны к спецсимволам (как в init-скрипте).
audit() {
  local result="$1" s3_key="$2" size_bytes="$3" duration="$4" stage="$5"
  docker exec -i "$PG_CONTAINER" \
    psql -v ON_ERROR_STOP=1 -q \
      -v cn="$COOPNAME" -v key="$s3_key" -v sz="$size_bytes" -v dur="$duration" \
      -v res="$result" -v stg="$stage" \
      --username "$PG_SUPERUSER" --dbname "$COOP_DOMAIN_DB" >/dev/null <<-'EOSQL'
		INSERT INTO audit_events (event, subject_id, actor, result, context)
		VALUES (
		  'coopid.backup.created', NULL, 'backup-cron', :'res',
		  jsonb_build_object(
		    'coopname', :'cn', 's3_key', :'key',
		    'size_bytes', (:'sz')::bigint, 'duration_seconds', (:'dur')::int,
		    'stage', :'stg'
		  )
		);
	EOSQL
}

run_backup() {
  local date_utc start end duration tmp archive size s3_key
  date_utc="$(date -u +%F)"
  start="$(date +%s)"
  s3_key="${COOPNAME}/${date_utc}.tar.gz"
  tmp="$(mktemp -d)"
  archive="${tmp}/${date_utc}.tar.gz"
  # shellcheck disable=SC2064  # tmp фиксируем сейчас, очистка при любом выходе
  trap "rm -rf '$tmp'" EXIT

  log "pg_basebackup кластера из контейнера $PG_CONTAINER"
  if ! docker exec "$PG_CONTAINER" \
        pg_basebackup --username "$PG_SUPERUSER" --format=tar --gzip \
          --wal-method=fetch --pgdata=- > "$archive"; then
    audit failure "$s3_key" 0 "$(( $(date +%s) - start ))" basebackup || true
    log "ОШИБКА: pg_basebackup не удался" >&2
    exit 1
  fi

  size="$(stat -c%s "$archive")"
  if [[ "$size" -le 0 ]]; then
    audit failure "$s3_key" 0 "$(( $(date +%s) - start ))" basebackup || true
    log "ОШИБКА: пустой архив бэкапа" >&2
    exit 1
  fi

  log "upload → s3://${S3_BUCKET}/${s3_key} (${size} байт, SSE=${S3_SSE})"
  if ! aws_s3 s3 cp "$archive" "s3://${S3_BUCKET}/${s3_key}" --sse "$S3_SSE"; then
    audit failure "$s3_key" "$size" "$(( $(date +%s) - start ))" upload || true
    log "ОШИБКА: загрузка в S3 не удалась" >&2
    exit 1
  fi

  end="$(date +%s)"
  duration="$(( end - start ))"
  audit success "$s3_key" "$size" "$duration" "done"
  log "готово: ${s3_key} за ${duration}s"
}

dry_run() {
  cat <<EOF
[dry-run] backup-команды для coopname=${COOPNAME}:
  docker exec ${PG_CONTAINER} pg_basebackup --username ${PG_SUPERUSER} \\
    --format=tar --gzip --wal-method=fetch --pgdata=- > <tmp>/$(date -u +%F).tar.gz
  aws${S3_ENDPOINT:+ --endpoint-url ${S3_ENDPOINT}} s3 cp <tmp>/$(date -u +%F).tar.gz \\
    s3://${S3_BUCKET}/${COOPNAME}/$(date -u +%F).tar.gz --sse ${S3_SSE}
  audit_events ← coopid.backup.created (s3_key, size_bytes, duration_seconds)
[dry-run] retention: S3 lifecycle expire ${RETENTION_DAYS}d (см. --setup)
EOF
}

case "$MODE" in
  setup) setup_bucket ;;
  dry-run) dry_run ;;
  backup) run_backup ;;
esac
