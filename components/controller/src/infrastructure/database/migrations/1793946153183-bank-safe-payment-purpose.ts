import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Назначение платежа без буквы «ё» (владелец 06.11.2026): банк не принимает
 * «ё» в назначении — «Цифровой Кошелёк» в паевом взносе, «аванс под отчёт» в
 * расходах. Новые записи пишутся уже без неё (`bankSafeText` в хранилищах
 * платежей и заявок на выплату, в строке QR-кода оплаты). Здесь — записи,
 * сделанные раньше: назначение платежа, назначение заявки и строка QR-кода
 * в реквизитах оплаты. Обратного хода нет: «е» вместо «ё» в назначении
 * смысла не меняет.
 */
const UP: readonly string[] = [
  `UPDATE "payments" SET "memo" = translate("memo", 'ёЁ', 'еЕ') WHERE "memo" ~ '[ёЁ]'`,
  `UPDATE "payments" SET "payment_details" = translate("payment_details"::text, 'ёЁ', 'еЕ')::json WHERE "payment_details"::text ~ '[ёЁ]'`,
  `UPDATE "payout_requests" SET "memo" = translate("memo", 'ёЁ', 'еЕ') WHERE "memo" ~ '[ёЁ]'`,
  `UPDATE "payout_requests" SET "payment_details" = translate("payment_details"::text, 'ёЁ', 'еЕ')::json WHERE "payment_details"::text ~ '[ёЁ]'`,
];

const DOWN: readonly string[] = [];

export class CoreBankSafePaymentPurpose1793946153183 implements SchemaMigration {
  name = 'CoreBankSafePaymentPurpose1793946153183';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
