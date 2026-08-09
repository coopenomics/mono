import type { DataSource } from 'typeorm';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * Свободные задачи («Мои задачи»): project_hash может быть NULL.
 * FK на capital_projects остаётся, но допускает отсутствие привязки.
 */
export default {
  name: 'capital issues nullable project hash',

  async up({
    dataSource,
    logger,
  }: {
    dataSource: DataSource;
    logger: MigrationLogger;
  }): Promise<boolean> {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const fks: Array<{ constraint_name: string }> = await qr.query(`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'capital_issues'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'project_hash'
      `);

      for (const fk of fks) {
        await qr.query(
          `ALTER TABLE capital_issues DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`
        );
        logger.info(`Dropped FK ${fk.constraint_name} on capital_issues.project_hash`);
      }

      await qr.query(`
        ALTER TABLE capital_issues
        ALTER COLUMN project_hash DROP NOT NULL
      `);

      await qr.query(`
        ALTER TABLE capital_issues
        DROP CONSTRAINT IF EXISTS fk_capital_issues_project_hash
      `);

      await qr.query(`
        ALTER TABLE capital_issues
        ADD CONSTRAINT fk_capital_issues_project_hash
        FOREIGN KEY (project_hash)
        REFERENCES capital_projects(project_hash)
        ON DELETE CASCADE
      `);

      await qr.commitTransaction();
      logger.info('capital_issues.project_hash is nullable (free tasks)');
      return true;
    } catch (e) {
      await qr.rollbackTransaction();
      logger.error(`V2.3.5 failed: ${(e as Error).message}`);
      throw e;
    } finally {
      await qr.release();
    }
  },
};
