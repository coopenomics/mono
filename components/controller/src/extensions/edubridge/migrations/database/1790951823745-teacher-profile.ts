import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Профиль преподавателя (расширение «edubridge»): рассказ о себе и ставка
 * часа, названная первым шагом подключения — до оферты и договора.
 *
 * Сгенерировано командой `pnpm schema:generate` — SQL выписан TypeORM из сущностей.
 */
const UP: readonly string[] = [
  "CREATE TABLE \"edubridge_teacher_profiles\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(13) NOT NULL, \"teacher_username\" character varying(13) NOT NULL, \"about\" text NOT NULL DEFAULT '', \"hourly_rate\" character varying(64) NOT NULL DEFAULT '0.0000 RUB', \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"PK_374bbdf35e43f2743095ffbe26b\" PRIMARY KEY (\"id\"))",
  "CREATE UNIQUE INDEX \"IDX_edubridge_teacher_profiles_unique\" ON \"edubridge_teacher_profiles\" (\"coopname\", \"teacher_username\") ",
];

const DOWN: readonly string[] = [
  "DROP INDEX \"public\".\"IDX_edubridge_teacher_profiles_unique\"",
  "DROP TABLE \"edubridge_teacher_profiles\"",
];

export class EdubridgeTeacherProfile1790951823745 implements MigrationInterface {
  name = 'EdubridgeTeacherProfile1790951823745';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
