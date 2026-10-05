import { Inject, Injectable } from '@nestjs/common';
import type { TableStore } from '@coopenomics/extension-kit';
import type { IMigrationRepository, MigrationDomainInterface } from '~/domain/system/repositories/migration-domain.repository';
import { KYSELY, type Database } from '../kysely.tokens';
import { migrationStore, type MigrationRecord } from '../records/migration.record';

/** Учёт миграций данных на Kysely. */
@Injectable()
export class MigrationKyselyRepository implements IMigrationRepository {
  private readonly store: TableStore<MigrationRecord>;

  constructor(@Inject(KYSELY) db: Database) {
    this.store = migrationStore(db);
  }

  async getMigrations(): Promise<MigrationDomainInterface[]> {
    return this.store.find({}, { order: { version: 'ASC' } });
  }

  async saveMigration(migration: MigrationDomainInterface): Promise<MigrationDomainInterface> {
    return this.store.save({ ...migration });
  }

  async getLastSuccessfulMigration(): Promise<MigrationDomainInterface | null> {
    return this.store.findOne({ success: true }, { order: { version: 'DESC' } });
  }

  async getMigrationByVersion(version: string): Promise<MigrationDomainInterface | null> {
    return this.store.findOne({ version });
  }

  async updateMigrationLogs(version: string, logs: string): Promise<void> {
    await this.store.update({ version }, { logs });
  }
}
