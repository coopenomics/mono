import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Новый хэш собрания после повторного созыва (`meet_pre.replaced_by`).
 *
 * Повторный созыв меняет хэш собрания в цепи: запись собрания переезжает на
 * новый хэш, а черновик прежнего остаётся. Ссылка по прежнему хэшу (письмо,
 * открытая вкладка) вела на черновик без собрания в цепи — пустая страница.
 * Черновик прежнего созыва помнит новый хэш, и чтение собрания идёт по цепочке
 * повторных созывов к действующему.
 */
const UP: readonly string[] = [
  `ALTER TABLE "meet_pre" ADD COLUMN IF NOT EXISTS "replaced_by" character varying`,
  `COMMENT ON COLUMN "meet_pre"."replaced_by" IS 'Хэш собрания после повторного созыва; пусто — собрание не созывалось повторно'`,
];

const DOWN: readonly string[] = [`ALTER TABLE "meet_pre" DROP COLUMN IF EXISTS "replaced_by"`];

export class CoreMeetPreReplacedBy1795536951950 implements SchemaMigration {
  name = 'CoreMeetPreReplacedBy1795536951950';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
