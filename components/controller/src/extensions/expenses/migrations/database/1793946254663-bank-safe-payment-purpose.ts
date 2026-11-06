import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Назначение платежа в снимке реквизитов служебной записки без буквы «ё»
 * (владелец 06.11.2026): кассир копирует его в банк, а банк «ё» не принимает
 * («Аванс под отчёт», «лицевого счёта»). Новые снимки пишутся уже без неё
 * (`bankSafeText`), здесь — снимки, сделанные раньше.
 */
const UP: readonly string[] = [
  `UPDATE "expense_requisite_snapshots" SET "payment_purpose" = translate("payment_purpose", 'ёЁ', 'еЕ') WHERE "payment_purpose" ~ '[ёЁ]'`,
];

export class ExpensesBankSafePaymentPurpose1793946254663 implements SchemaMigration {
  name = 'ExpensesBankSafePaymentPurpose1793946254663';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(): Promise<void> {
    // Обратного хода нет: «е» вместо «ё» в назначении смысла не меняет.
  }
}
