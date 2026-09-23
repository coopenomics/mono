/**
 * Идемпотентный DDL для стартовых миграций схемы.
 *
 * Стартовая миграция обязана работать на трёх видах базы:
 * - пустой (новый кооператив) — создаёт всё;
 * - существующей, которую до сих пор вёл `synchronize` (все действующие узлы);
 * - частично заведённой вручную (boot стенда создаёт `users`, `vaults` и др.).
 *
 * Поэтому каждая инструкция проверяет, нет ли уже того, что она создаёт, и
 * только добавляет: таблицы, колонки, типы, ключи, индексы. Ничего не удаляет
 * и не меняет существующее — расхождения по типам и умолчаниям показывает
 * `schema:check`, а решает их отдельная миграция.
 *
 * Инструкции берутся у самого TypeORM (`createSchemaBuilder().log()` против
 * базы, где у каждой таблицы нет ни одной колонки), поэтому SQL совпадает с
 * тем, что раньше выполнял `synchronize`. Незнакомая форма инструкции —
 * ошибка генератора, а не молчаливый пропуск.
 */

const IDENT = '"((?:[^"]|"")+)"';
const TABLE = `(?:"public"\\.)?${IDENT}`;

/** Имя таблицы, к которой относится инструкция; `null` — инструкция не про таблицу. */
export function statementTable(sql: string): string | null {
  const patterns = [
    new RegExp(`^ALTER TABLE ${TABLE}`),
    new RegExp(`^CREATE (?:UNIQUE )?INDEX ${IDENT} ON ${TABLE}`),
    new RegExp(`^CREATE TABLE ${TABLE}`),
    new RegExp(`^COMMENT ON COLUMN ${TABLE}\\.`),
  ];
  for (const [index, pattern] of patterns.entries()) {
    const match = sql.match(pattern);
    if (match) return index === 1 ? match[2] : match[1];
  }
  return null;
}

/** Таблица, на которую ссылается внешний ключ, либо `null`. */
export function referencedTable(sql: string): string | null {
  const match = sql.match(new RegExp(`REFERENCES ${TABLE}`));
  return match ? match[1] : null;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Обернуть инструкцию в анонимный блок, который выполняет её при условии. */
function guarded(condition: string, sql: string): string {
  return `DO $$ BEGIN IF ${condition} THEN ${sql}; END IF; END $$`;
}

/**
 * Идемпотентная форма инструкции TypeORM.
 *
 * @param sql — инструкция из `createSchemaBuilder().log().upQueries`.
 * @returns Инструкция, безопасная для повторного выполнения и для базы, где
 *   объект уже есть.
 * @throws Error Если форма инструкции незнакома — генератор должен остановиться.
 */
export function toIdempotent(sql: string): string {
  let match: RegExpMatchArray | null;

  if ((match = sql.match(/^CREATE TYPE ((?:"[^"]+"\.)?"[^"]+") AS ENUM/))) {
    return `DO $$ BEGIN ${sql}; EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  }

  if ((match = sql.match(new RegExp(`^CREATE TABLE ${TABLE} \\(`)))) {
    return sql.replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ');
  }

  if ((match = sql.match(/^CREATE (UNIQUE )?INDEX "/))) {
    return sql.replace(/^CREATE (UNIQUE )?INDEX /, (_, unique = '') => `CREATE ${unique}INDEX IF NOT EXISTS `);
  }

  if ((match = sql.match(new RegExp(`^ALTER TABLE ${TABLE} ADD CONSTRAINT ${IDENT} PRIMARY KEY`)))) {
    const table = quoteLiteral(`"${match[1]}"`);
    return guarded(
      `NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = ${table}::regclass AND contype = 'p')`,
      sql
    );
  }

  if ((match = sql.match(new RegExp(`^ALTER TABLE ${TABLE} ADD CONSTRAINT ${IDENT} `)))) {
    const table = quoteLiteral(`"${match[1]}"`);
    const name = quoteLiteral(match[2]);
    // Уникальное ограничение создаёт одноимённый индекс — проверяем и его:
    // на старой базе имя могло остаться у индекса без ограничения.
    return guarded(
      `NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = ${table}::regclass AND conname = ${name}) ` +
        `AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = ${name} AND relkind = 'i')`,
      sql
    );
  }

  if ((match = sql.match(new RegExp(`^ALTER TABLE ${TABLE} ADD ${IDENT} `)))) {
    return sql.replace(/ ADD "/, ' ADD COLUMN IF NOT EXISTS "');
  }

  if (/^COMMENT ON COLUMN /.test(sql)) return sql;

  throw new Error(`Незнакомая форма инструкции схемы, генератор остановлен: ${sql}`);
}

/**
 * Шаг, который дотягивает таблицу, существовавшую до миграций: недостающая
 * колонка, уникальное ограничение или проверка. Перестройку первичного ключа
 * по мере добавления колонок (`DROP CONSTRAINT` + `ADD … PRIMARY KEY`) не
 * берём — на живой таблице она снесла бы настоящий ключ. Внешние ключи, индексы
 * и типы приходят из прохода по пустой базе.
 */
export function isLegacyTableStep(sql: string): boolean {
  const constraint = sql.match(new RegExp(`^ALTER TABLE ${TABLE} ADD CONSTRAINT ${IDENT} (UNIQUE|PRIMARY KEY|FOREIGN KEY|CHECK) `));
  if (constraint) return constraint[3] === 'UNIQUE' || constraint[3] === 'CHECK';
  if (new RegExp(`^ALTER TABLE ${TABLE} DROP CONSTRAINT ${IDENT}$`).test(sql)) return false;
  if (new RegExp(`^ALTER TABLE ${TABLE} ADD ${IDENT} `).test(sql)) return true;
  if (/^(CREATE TYPE|CREATE (UNIQUE )?INDEX|COMMENT ON COLUMN)/.test(sql)) return false;
  throw new Error(`Незнакомый шаг дотягивания таблицы, генератор остановлен: ${sql}`);
}

/** Создание таблицы без колонок — подготовка прохода «дотягивания» в генераторе. */
export function createEmptyTable(table: string): string {
  return `CREATE TABLE IF NOT EXISTS "${table.replace(/"/g, '""')}" ()`;
}

/**
 * Починка частичного индекса на старой базе.
 *
 * `synchronize` не сравнивал условие `WHERE` у индексов: индекс, однажды
 * созданный полным, так и оставался полным, и держали его пересоздание при
 * каждом старте отдельные службы. Здесь это делается один раз: индекс с тем же
 * именем, построенный без условия, удаляется и создаётся заново частичным.
 *
 * @param createIndexSql — инструкция TypeORM `CREATE … INDEX "…" ON … WHERE …`.
 * @returns Защищённая инструкция либо `null`, если индекс не частичный.
 */
export function repairPartialIndex(createIndexSql: string): string | null {
  const match = createIndexSql.match(new RegExp(`^CREATE (?:UNIQUE )?INDEX ${IDENT} ON .+ WHERE .+$`));
  if (!match) return null;
  const name = match[1];
  const escaped = name.replace(/"/g, '""');
  return (
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = ${quoteLiteral(name)} ` +
    `AND indexdef NOT LIKE '% WHERE %') THEN DROP INDEX "${escaped}"; ${createIndexSql}; END IF; END $$`
  );
}
