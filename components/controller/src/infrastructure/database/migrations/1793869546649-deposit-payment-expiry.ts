import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Срок оплаты у неоплаченных паевых взносов (решение владельца 05.11.2026).
 *
 * До этой версии паевой взнос заводился бессрочным: передуманный или
 * ошибочный взнос вечно висел у пайщика «в работе». Теперь у нового взноса
 * трое суток на оплату, потом сторож истечения переводит его в «Истёк»
 * (кассир по-прежнему подтверждает его, если деньги пришли). Висящим взносам,
 * заведённым до правки, срок проставляется тем же правилом — трое суток от
 * создания; ушедшие за срок истекут при ближайшем обходе сторожа.
 *
 * Трогаются только неоплаченные входящие паевые взносы без срока. Обратно —
 * срок снимается у тех же взносов, ещё не истёкших.
 */
export class CoreDepositPaymentExpiry1793869546649 implements MigrationInterface {
  name = 'CoreDepositPaymentExpiry1793869546649';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "payments" SET "expired_at" = "created_at" + interval '3 days' ` +
        `WHERE "type" = 'deposit' AND "direction" = 'incoming' AND "status" = 'pending' AND "expired_at" IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "payments" SET "expired_at" = NULL ` +
        `WHERE "type" = 'deposit' AND "direction" = 'incoming' AND "status" = 'pending'`
    );
  }
}
