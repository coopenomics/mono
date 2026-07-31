import type { DataSource } from 'typeorm';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * Персональные проекты: origin blockchain|local + local_owner.
 * Существующие строки — blockchain.
 */
export default {
  name: 'capital projects origin local',

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
      await qr.query(`
        DO $$ BEGIN
          CREATE TYPE capital_project_origin AS ENUM ('blockchain', 'local');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await qr.query(`
        ALTER TABLE capital_projects
        ADD COLUMN IF NOT EXISTS origin capital_project_origin NOT NULL DEFAULT 'blockchain'
      `);

      await qr.query(`
        ALTER TABLE capital_projects
        ADD COLUMN IF NOT EXISTS local_owner varchar(12) NULL
      `);

      await qr.query(`
        CREATE INDEX IF NOT EXISTS idx_capital_projects_origin
        ON capital_projects (origin)
      `);

      await qr.query(`
        CREATE INDEX IF NOT EXISTS idx_capital_projects_local_owner
        ON capital_projects (local_owner)
        WHERE local_owner IS NOT NULL
      `);

      await qr.commitTransaction();
      logger.info('capital_projects.origin / local_owner added');
      return true;
    } catch (e) {
      await qr.rollbackTransaction();
      logger.error(`V2.3.6 failed: ${(e as Error).message}`);
      throw e;
    } finally {
      await qr.release();
    }
  },
};
