import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID, задача 105-29: журнал верификаций личности и очередь проверки советом.
 *
 * В цепи истории нет — вектор `verifications` хранит только текущее состояние,
 * а отзыв запись стирает. Поэтому «что, когда и кто» ведём здесь: строка
 * заводится в момент сверки на участке и доживает до решения совета.
 *
 * `photos` — снимки сверки (ключи в файловом хранилище кооператива). Хранятся
 * временно: после решения председателя массив опустошается, а сами объекты
 * удаляются из хранилища. Остаётся только факт сверки и её судьба.
 *
 * Перенесена дословно из миграции данных `V2.5.4__coopid_verification_reviews.ts` (учёт `2.5.4`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainVerificationReviews1781000000016 implements SchemaMigration {
  name = 'CoopDomainVerificationReviews1781000000016';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS verification_reviews (
        id uuid PRIMARY KEY,
        username text NOT NULL,
        procedure text NOT NULL DEFAULT 'passport',
        braname text NOT NULL DEFAULT '',
        verificator text NOT NULL,
        status text NOT NULL,
        photos jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        decided_by text,
        decided_at timestamptz,
        decision_reason text
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS verification_reviews_status_idx ON verification_reviews (status, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS verification_reviews_username_idx ON verification_reviews (username, created_at DESC);`);
  }
}
