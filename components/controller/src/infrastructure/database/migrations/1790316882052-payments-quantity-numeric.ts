import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Сумма платежа — с копейками.
 *
 * Колонка `payments.quantity` была integer: исходящая выплата с копейками
 * (материальная помощь после удержания налога, выплата поставщику) падала
 * «invalid input syntax for type integer» и не регистрировалась. Прежние
 * целые суммы переносятся без потерь.
 */
export class PaymentsQuantityNumeric1790316882052 implements MigrationInterface {
  name = 'PaymentsQuantityNumeric1790316882052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "payments" ALTER COLUMN "quantity" TYPE numeric(20,4) USING "quantity"::numeric(20,4)'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Обратно в integer без потери копеек не вернуть.
    throw new Error('PaymentsQuantityNumeric1790316882052 не откатывается: копейки в суммах платежей были бы потеряны');
  }
}
