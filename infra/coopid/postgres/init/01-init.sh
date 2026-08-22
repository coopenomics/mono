#!/usr/bin/env bash
# Инициализация coop-postgres (выполняется entrypoint'ом postgres только при пустом data dir):
# две БД с ролевой изоляцией — authentik_db (authentik_user) и coop_domain_db (coop_app_user).
# Пароли ролей берутся из Docker Secrets, в env/compose они не попадают.
set -euo pipefail

AUTHENTIK_PW="$(cat /run/secrets/coop_pg_authentik_password)"
APP_PW="$(cat /run/secrets/coop_pg_app_password)"

# Пароли — через psql-переменные с квотированием :'var': не попадают в текст
# SQL-команды (логи statement'ов, pg_stat_activity) и безопасны к спецсимволам.
psql -v ON_ERROR_STOP=1 -v apw="$AUTHENTIK_PW" -v cpw="$APP_PW" \
	--username "$POSTGRES_USER" --dbname postgres <<-'EOSQL'
	CREATE ROLE authentik_user LOGIN PASSWORD :'apw';
	CREATE ROLE coop_app_user LOGIN PASSWORD :'cpw';

	CREATE DATABASE authentik_db OWNER authentik_user;
	CREATE DATABASE coop_domain_db OWNER coop_app_user;

	-- Ролевая изоляция: подключаться к БД может только её владелец (и суперпользователь).
	REVOKE CONNECT ON DATABASE authentik_db FROM PUBLIC;
	REVOKE CONNECT ON DATABASE coop_domain_db FROM PUBLIC;
EOSQL

# Запрет создания объектов в public-схеме чужой БД на случай выдачи CONNECT в будущем.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname authentik_db <<-EOSQL
	REVOKE ALL ON SCHEMA public FROM PUBLIC;
	GRANT ALL ON SCHEMA public TO authentik_user;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname coop_domain_db <<-EOSQL
	REVOKE ALL ON SCHEMA public FROM PUBLIC;
	GRANT ALL ON SCHEMA public TO coop_app_user;
EOSQL
