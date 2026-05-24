import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Story 2.1: таблица consumer_dedup как фундамент идемпотентности (INV-09, NFR5).
 *
 * Прод-путь схемы (ormconfig.ts: migrationsRun=true, synchronize=false). В dev
 * таблица создаётся entity-синком (synchronize:true в typeorm.module), здесь —
 * детерминированный DDL для прод-наката. Без тяжёлых constraints (RT-03):
 * event_id — PK, отдельный индекс по applied_at для retention-очистки.
 */
export class CreateConsumerDedup1779000000000 implements MigrationInterface {
  name = 'CreateConsumerDedup1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'consumer_dedup',
        columns: [
          { name: 'event_id', type: 'varchar', length: '512', isPrimary: true },
          { name: 'applied_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'consumer_dedup',
      new TableIndex({
        name: 'idx_consumer_dedup_applied_at',
        columnNames: ['applied_at'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('consumer_dedup', 'idx_consumer_dedup_applied_at');
    await queryRunner.dropTable('consumer_dedup');
  }
}
