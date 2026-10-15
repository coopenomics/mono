/**
 * Идемпотентный DDL стартовых миграций (C28-79).
 *
 * Стартовая миграция идёт и на пустую базу, и на базу, которую годами вёл
 * synchronize, и на стенд, где boot заранее завёл часть таблиц руками. Поэтому
 * каждая инструкция обязана только добавлять недостающее и никогда не ломать
 * существующее — прежде всего первичный ключ живой таблицы.
 */
import {
  createEmptyTable,
  isLegacyTableStep,
  referencedTable,
  repairPartialIndex,
  statementTable,
  toIdempotent,
} from '~/infrastructure/database/schema/idempotent-ddl';

describe('toIdempotent', () => {
  it('таблица создаётся, только если её нет', () => {
    expect(toIdempotent('CREATE TABLE "users" ("id" integer NOT NULL, CONSTRAINT "PK_1" PRIMARY KEY ("id"))')).toBe(
      'CREATE TABLE IF NOT EXISTS "users" ("id" integer NOT NULL, CONSTRAINT "PK_1" PRIMARY KEY ("id"))'
    );
  });

  it('колонка добавляется, только если её нет', () => {
    expect(toIdempotent('ALTER TABLE "users" ADD "email" character varying')).toBe(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" character varying'
    );
  });

  it('индекс — IF NOT EXISTS, в том числе уникальный', () => {
    expect(toIdempotent('CREATE UNIQUE INDEX "IDX_a" ON "users" ("email") WHERE email IS NOT NULL')).toBe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_a" ON "users" ("email") WHERE email IS NOT NULL'
    );
    expect(toIdempotent('CREATE INDEX "IDX_b" ON "users" ("role") ')).toBe(
      'CREATE INDEX IF NOT EXISTS "IDX_b" ON "users" ("role") '
    );
  });

  it('тип перечисления: повторное создание гасится', () => {
    const sql = toIdempotent(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'chairman')`);
    expect(sql).toContain('EXCEPTION WHEN duplicate_object THEN NULL');
  });

  it('первичный ключ добавляется, только если у таблицы нет никакого — имя на старой базе может быть другим', () => {
    const sql = toIdempotent('ALTER TABLE "vaults" ADD CONSTRAINT "PK_x" PRIMARY KEY ("id")');
    expect(sql).toContain(`conrelid = '"vaults"'::regclass AND contype = 'p'`);
  });

  it('ограничение по имени: проверяются и само ограничение, и одноимённый индекс', () => {
    const sql = toIdempotent('ALTER TABLE "users" ADD CONSTRAINT "UQ_u" UNIQUE ("username")');
    expect(sql).toContain(`conname = 'UQ_u'`);
    expect(sql).toContain(`relname = 'UQ_u' AND relkind = 'i'`);
  });

  it('незнакомая форма — ошибка генератора, а не пропуск', () => {
    expect(() => toIdempotent('ALTER TABLE "users" DROP COLUMN "email"')).toThrow('Незнакомая форма');
  });
});

describe('isLegacyTableStep', () => {
  it('колонки, уникальные ограничения и проверки дотягивают старую таблицу', () => {
    expect(isLegacyTableStep('ALTER TABLE "users" ADD "email" character varying')).toBe(true);
    expect(isLegacyTableStep('ALTER TABLE "users" ADD CONSTRAINT "uq_x" UNIQUE ("a", "b")')).toBe(true);
    expect(isLegacyTableStep('ALTER TABLE "users" ADD CONSTRAINT "CHK_x" CHECK ("a" > 0)')).toBe(true);
  });

  it('перестройка первичного ключа не берётся — она снесла бы ключ живой таблицы', () => {
    expect(isLegacyTableStep('ALTER TABLE "attrs" DROP CONSTRAINT "PK_e3"')).toBe(false);
    expect(isLegacyTableStep('ALTER TABLE "attrs" ADD CONSTRAINT "PK_e3" PRIMARY KEY ("a", "b")')).toBe(false);
  });

  it('внешние ключи, индексы и типы приходят из прохода по пустой базе', () => {
    expect(isLegacyTableStep('ALTER TABLE "a" ADD CONSTRAINT "FK_1" FOREIGN KEY ("b") REFERENCES "b"("id")')).toBe(
      false
    );
    expect(isLegacyTableStep('CREATE INDEX "IDX_1" ON "a" ("b") ')).toBe(false);
  });
});

describe('разбор инструкций', () => {
  it('таблица инструкции', () => {
    expect(statementTable('ALTER TABLE "users" ADD "x" integer')).toBe('users');
    expect(statementTable('CREATE UNIQUE INDEX "IDX_1" ON "public"."users" ("x") ')).toBe('users');
    expect(statementTable(`COMMENT ON COLUMN "capital_time_entries"."hash" IS 'Хеш'`)).toBe('capital_time_entries');
    expect(statementTable(`CREATE TYPE "public"."x_enum" AS ENUM('a')`)).toBeNull();
  });

  it('таблица, на которую ссылается внешний ключ', () => {
    expect(referencedTable('ALTER TABLE "a" ADD CONSTRAINT "FK_1" FOREIGN KEY ("u") REFERENCES "users"("id")')).toBe(
      'users'
    );
  });

  it('пустая таблица для прохода «дотягивания»', () => {
    expect(createEmptyTable('users')).toBe('CREATE TABLE IF NOT EXISTS "users" ()');
  });
});

describe('repairPartialIndex', () => {
  it('частичный индекс, построенный на старой базе полным, пересоздаётся', () => {
    const create = 'CREATE UNIQUE INDEX "idx_w" ON "user_wallets" ("a") WHERE "present" = true';
    const sql = repairPartialIndex(create);
    expect(sql).toContain(`indexname = 'idx_w' AND indexdef NOT LIKE '% WHERE %'`);
    expect(sql).toContain('DROP INDEX "idx_w"');
    expect(sql).toContain(create);
  });

  it('обычный индекс не трогается', () => {
    expect(repairPartialIndex('CREATE INDEX "IDX_1" ON "a" ("b") ')).toBeNull();
  });
});
