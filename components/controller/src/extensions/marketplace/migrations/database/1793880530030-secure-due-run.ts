import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Список прогона списания обеспечительной части (задача 99D-22, аудит
 * коэффициента экономического участия 05.11.2026, решения владельца).
 *
 * У строки учёта к списанию появляются две отметки:
 *  - `run_period` — номер месяца, в расчёт итога которого вошла строка. Итог
 *    месяца участка считается по всем строкам с этим номером, и проходы месяца
 *    списывают только их. Строка без номера (гарантийный возврат закрыт после
 *    расчёта) ждёт следующего первого числа;
 *  - `charge_sent_at` — когда узел отправил списание строки в цепь. Отметка
 *    ставится до отправки, строку с отметкой проход не берёт: заказ не
 *    списывается второй раз, если операции списания не дошли до учёта.
 */
const UP: readonly string[] = [
  'ALTER TABLE "marketplace_secure_due" ADD COLUMN IF NOT EXISTS "run_period" integer',
  'ALTER TABLE "marketplace_secure_due" ADD COLUMN IF NOT EXISTS "charge_sent_at" TIMESTAMP WITH TIME ZONE',
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_secure_due_run" ON "marketplace_secure_due" ("coopname", "braname", "run_period") WHERE "charged_at" IS NULL',
  // Сверка каждого прохода ищет отправленные и не закрытые строки: их единицы, индекс только по ним.
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_secure_due_sent" ON "marketplace_secure_due" ("coopname", "charge_sent_at") WHERE "charge_sent_at" IS NOT NULL AND "charged_at" IS NULL',
];

const DOWN: readonly string[] = [
  'DROP INDEX IF EXISTS "IDX_marketplace_secure_due_sent"',
  'DROP INDEX IF EXISTS "IDX_marketplace_secure_due_run"',
  'ALTER TABLE "marketplace_secure_due" DROP COLUMN IF EXISTS "charge_sent_at"',
  'ALTER TABLE "marketplace_secure_due" DROP COLUMN IF EXISTS "run_period"',
];

export class MarketplaceSecureDueRun1793880530030 implements SchemaMigration {
  name = 'MarketplaceSecureDueRun1793880530030';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
