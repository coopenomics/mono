import type { DataSource } from 'typeorm';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * История редакций содержимого (capital_content_revisions) для проектов/компонентов, задач и артефактов.
 *
 * Мигратор работает до synchronize приложения, поэтому колонка `content_rev` и таблица снимков
 * создаются здесь (IF NOT EXISTS; потом synchronize видит их готовыми). Каждой существующей сущности
 * записывается первичный снимок rev = 1 из текущего текста — история и серверное слияние работают сразу.
 * Сервис ревизий умеет сеять rev = 1 лениво, так что миграция безопасна и на частично заполненной базе.
 */
export default {
  name: 'capital content revisions backfill',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`
        CREATE TABLE IF NOT EXISTS capital_content_revisions (
          _id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type varchar(16) NOT NULL,
          entity_hash varchar(64) NOT NULL,
          rev integer NOT NULL,
          base_rev integer NULL,
          title varchar(255) NOT NULL,
          description text NULL,
          content_format varchar(16) NULL,
          content_hash varchar(64) NOT NULL,
          author varchar(64) NOT NULL,
          origin varchar(16) NOT NULL,
          restored_from_rev integer NULL,
          merged boolean NOT NULL DEFAULT false,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await qr.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_capital_content_revisions_entity_rev
          ON capital_content_revisions (entity_type, entity_hash, rev)
      `);
      await qr.query(`
        CREATE INDEX IF NOT EXISTS idx_capital_content_revisions_entity_created
          ON capital_content_revisions (entity_type, entity_hash, created_at)
      `);

      const targets: Array<{ table: string; hashColumn: string; entityType: string; formatExpr: string }> = [
        { table: 'capital_projects', hashColumn: 'project_hash', entityType: 'PROJECT', formatExpr: 'NULL' },
        { table: 'capital_issues', hashColumn: 'issue_hash', entityType: 'ISSUE', formatExpr: 'NULL' },
        { table: 'capital_stories', hashColumn: 'story_hash', entityType: 'STORY', formatExpr: 'content_format::text' },
      ];

      for (const t of targets) {
        const exists: Array<{ reg: string | null }> = await qr.query(`SELECT to_regclass('public.${t.table}') AS reg`);
        if (!exists[0]?.reg) {
          logger.info(`${t.table} отсутствует — пропуск (чистая база, таблицу создаст synchronize)`);
          continue;
        }
        await qr.query(`ALTER TABLE ${t.table} ADD COLUMN IF NOT EXISTS content_rev integer NOT NULL DEFAULT 0`);
        const inserted: Array<{ n: string }> = await qr.query(`
          WITH seeded AS (
            INSERT INTO capital_content_revisions
              (entity_type, entity_hash, rev, base_rev, title, description, content_format, content_hash, author, origin, merged)
            SELECT
              '${t.entityType}', s.${t.hashColumn}, 1, NULL,
              COALESCE(s.title, ''), COALESCE(s.description, ''), ${t.formatExpr},
              encode(sha256(convert_to(COALESCE(s.title, '') || E'\\n' || COALESCE(s.description, ''), 'UTF8')), 'hex'),
              'system', 'BACKFILL', false
            FROM ${t.table} s
            WHERE s.content_rev = 0
              AND NOT EXISTS (
                SELECT 1 FROM capital_content_revisions r
                WHERE r.entity_type = '${t.entityType}' AND r.entity_hash = s.${t.hashColumn}
              )
            RETURNING 1
          )
          SELECT count(*)::text AS n FROM seeded
        `);
        await qr.query(`UPDATE ${t.table} SET content_rev = 1 WHERE content_rev = 0`);
        logger.info(`${t.table}: первичных снимков записано ${inserted[0]?.n ?? '0'}`);
      }

      await qr.commitTransaction();
      return true;
    } catch (error) {
      await qr.rollbackTransaction();
      logger.error(`capital content revisions backfill failed: ${(error as Error).message}`);
      throw error;
    } finally {
      await qr.release();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    // Снимки — история; обратная миграция их не удаляет.
    logger.info('capital content revisions backfill: down — ничего не делаем (история сохраняется)');
    return true;
  },
};
