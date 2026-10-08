import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Тип платежа «беспроцентный заём»: выплата пайщику по договору займа
 * (компонент 73, контракт `debt`). Кассир подтверждает её общим путём
 * исходящих платежей шлюза.
 */
export class PaymentsTypeLoan1791000000001 implements MigrationInterface {
  name = 'PaymentsTypeLoan1791000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "public"."payments_type_enum" ADD VALUE IF NOT EXISTS \'loan\'');
  }

  public async down(): Promise<void> {
    // Значение перечисления в Postgres назад не снимается.
  }
}
