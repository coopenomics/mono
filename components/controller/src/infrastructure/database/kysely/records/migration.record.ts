import type { Kysely } from 'kysely';
import { TableStore } from '@coopenomics/extension-kit';

/** Запись учёта миграций данных (таблица `migrations`). */
export class MigrationRecord {
  version!: string;

  name!: string;

  executedAt!: Date;

  success!: boolean;

  logs?: string;

  createdAt!: Date;

  updatedAt!: Date;
}

/** Шлюз таблицы учёта миграций данных; имена колонок совпадают с полями записи. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrationStore(db: Kysely<any>): TableStore<MigrationRecord> {
  return new TableStore<MigrationRecord>(db, { table: 'migrations', primaryKey: ['version'], updatedAt: 'updatedAt', sameNames: true });
}
