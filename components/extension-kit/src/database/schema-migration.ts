/**
 * Соединение, которым миграция схемы выполняет свои запросы. Все запросы
 * одной миграции идут одной транзакцией: упавшая миграция откатывается целиком.
 */
export interface SchemaQueryRunner {
  /** Выполняет запрос; у выборки возвращает строки. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(sql: string, parameters?: unknown[]): Promise<any>;
}

/**
 * Миграция схемы базы: таблицы, колонки, индексы. Имя оканчивается меткой
 * времени (13 цифр) — по ней миграции выстраиваются в ленту; применённые
 * учитываются по имени в таблице `schema_migrations`.
 */
export interface SchemaMigration {
  name?: string;
  up(queryRunner: SchemaQueryRunner): Promise<void>;
  down?(queryRunner: SchemaQueryRunner): Promise<void>;
}

export type SchemaMigrationClass = new () => SchemaMigration;
