import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Идентификаторы строк очереди уведомлений у записи журнала (C28-75,
 * 25.11.2026): по ним приложение спрашивает у центра уведомлений, доставлено
 * ли письмо, и показывает доставку в журнале и календаре рассылок.
 */
const UP: readonly string[] = [
  `ALTER TABLE "greetings_sends" ADD COLUMN IF NOT EXISTS "outbox_ids" jsonb NOT NULL DEFAULT '[]'::jsonb`,
  `COMMENT ON COLUMN "greetings_sends"."outbox_ids" IS 'Строки очереди уведомлений письма — по каналам; по ним читается состояние доставки'`,
];

export class GreetingsOutboxIds1795588858293 implements SchemaMigration {
  name = 'GreetingsOutboxIds1795588858293';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "greetings_sends" DROP COLUMN IF EXISTS "outbox_ids"`);
  }
}
