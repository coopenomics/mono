#!/bin/bash
#
# Показывает, в каком регистре лежат хэши в базе узла.
#
# Зачем: регистр шестнадцатеричной записи ничего не значит для самого хэша, но
# значит всё для поиска — узел ищет по хэшу точным сравнением. Прежний индексер
# отдавал хэши заглавными, новый отдаёт строчными, и если регистр в базе поедет,
# старые записи перестанут находиться по новым значениям. Ошибка при этом
# молчаливая: ни исключения, ни расхождения в контрольной сумме — просто пустой
# результат там, где данные есть.
#
# Как пользоваться: прогнать ДО обновления узла и ПОСЛЕ. Раскладка по колонкам
# обязана совпасть. Появление строчных значений в колонке, где раньше были
# только заглавные (или наоборот), означает, что нормализация на входе не
# сработала — с этим и надо разбираться, а не искать «почему не находится
# документ».
#
# Пример:
#   ./scripts/audit-hash-case.sh voskhod-postgres root voskhod
#
set -euo pipefail

CONTAINER="${1:-voskhod-postgres}"
USER_NAME="${2:-root}"
DB_NAME="${3:-voskhod}"

# Список колонок с хэшами берём из самой схемы: перечислять руками бессмысленно,
# их несколько десятков и они прибавляются с каждым расширением.
QUERY=$(docker exec "$CONTAINER" psql -U "$USER_NAME" -d "$DB_NAME" -t -A -c "
SELECT string_agg(
  format('SELECT %L AS kolonka, count(*) AS vsego, count(*) FILTER (WHERE %I = lower(%I)) AS strochnye, count(*) FILTER (WHERE %I = upper(%I)) AS zaglavnye FROM %I WHERE %I IS NOT NULL AND %I <> ''''',
    table_name||'.'||column_name, column_name, column_name, column_name, column_name, table_name, column_name, column_name),
  ' UNION ALL ')
FROM information_schema.columns
WHERE table_schema='public'
  AND (column_name LIKE '%hash%' OR column_name IN ('transaction_id','block_id'))
  AND data_type IN ('character varying','text','character')")

if [ -z "$QUERY" ]; then
  echo "В базе $DB_NAME нет колонок с хэшами — проверять нечего"
  exit 0
fi

# Значение из одних цифр попадает и в строчные, и в заглавные одновременно
# (нулевой хэш, например) — поэтому колонки считаются отдельно, а не в проценты.
docker exec -i "$CONTAINER" psql -U "$USER_NAME" -d "$DB_NAME" <<SQL
SELECT * FROM ($QUERY) t WHERE vsego > 0 ORDER BY kolonka;
SQL
