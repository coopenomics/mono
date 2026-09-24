import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Фотография пайщика (users.avatar_key, avatar_mime) и заявление об аннулировании программных соглашений при выходе (membership_exit_requests.annulment).
 *
 * Инструкции идемпотентны: на стендах, где колонки уже завёл synchronize,
 * миграция проходит без ошибки. SQL выписан TypeORM (`pnpm schema:generate`).
 */
const UP: readonly string[] = [
  "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"avatar_key\" text",
  "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"avatar_mime\" character varying(40)",
  "ALTER TABLE \"membership_exit_requests\" ADD COLUMN IF NOT EXISTS \"annulment\" jsonb",
];

const DOWN: readonly string[] = [
  "ALTER TABLE \"membership_exit_requests\" DROP COLUMN \"annulment\"",
  "ALTER TABLE \"users\" DROP COLUMN \"avatar_mime\"",
  "ALTER TABLE \"users\" DROP COLUMN \"avatar_key\"",
];

export class CoreUserAvatarExitAnnulment1790236885855 implements MigrationInterface {
  name = 'CoreUserAvatarExitAnnulment1790236885855';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
