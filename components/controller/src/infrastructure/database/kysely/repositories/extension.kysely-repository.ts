import { Inject, Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';
import { ExtensionDomainRepository, ExtensionDomainEntity, DomainError } from '@coopenomics/extension-kit';
import type { Extensions } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

/**
 * Установленные расширения кооператива и их настройки (таблица `extensions`).
 * По настройкам живут шаги подключения расширений и рабочий стол; сигнал ленты
 * изменений о записи шлёт слой базы.
 */
@Injectable()
export class ExtensionKyselyRepository<TConfig = any> implements ExtensionDomainRepository<TConfig> {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findByName(name: string): Promise<ExtensionDomainEntity<TConfig> | null> {
    const row = await this.db.selectFrom('extensions').selectAll().where('name', '=', name).executeTakeFirst();
    return row ? this.toDomain(row) : null;
  }

  async deleteByName(name: string): Promise<boolean> {
    const rows = await this.db.deleteFrom('extensions').where('name', '=', name).returningAll().execute();
    return rows.length > 0;
  }

  async create(data: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>> {
    const values = {
      name: data.name as string,
      enabled: data.enabled,
      config: JSON.stringify(data.config ?? {}),
      schema_version: (data as { schema_version?: number }).schema_version ?? 1,
    };
    // Повторная установка расширения с тем же именем перезаписывает запись, как и прежде.
    const row = await this.db
      .insertInto('extensions')
      .values(values)
      .onConflict((conflict) => conflict.column('name').doUpdateSet({ ...values, updated_at: sql`now()` }))
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toDomain(row);
  }

  async find(filter: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>[]> {
    let query = this.db.selectFrom('extensions').selectAll();
    if (filter.name !== undefined) query = query.where('name', '=', filter.name);
    if (filter.enabled !== undefined) query = query.where('enabled', '=', filter.enabled);
    const rows = await query.execute();
    return rows.map((row) => this.toDomain(row));
  }

  async update(data: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>> {
    const name = data.name;
    if (!name) throw DomainError.badRequest('DATABASE_EXTENSION_NAME_REQUIRED');

    const schemaVersion = (data as { schema_version?: number }).schema_version;
    // Обновляются только переданные поля.
    const row = await this.db
      .updateTable('extensions')
      .set({
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.config !== undefined ? { config: JSON.stringify(data.config ?? {}) } : {}),
        ...(schemaVersion !== undefined ? { schema_version: schemaVersion } : {}),
        updated_at: sql`now()`,
      })
      .where('name', '=', name)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw DomainError.internal('DATABASE_EXTENSION_NOT_INSTALLED');
    return this.toDomain(row);
  }

  async patchConfig(name: string, patch: Partial<TConfig>): Promise<ExtensionDomainEntity<TConfig>> {
    // Слияние на стороне базы: параллельные правки разных ключей не затирают друг друга.
    const row = await this.db
      .updateTable('extensions')
      .set({
        config: sql`COALESCE(config, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`,
        updated_at: sql`now()`,
      })
      .where('name', '=', name)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw DomainError.internal('DATABASE_EXTENSION_NOT_INSTALLED');
    return this.toDomain(row);
  }

  private toDomain(row: Selectable<Extensions>): ExtensionDomainEntity<TConfig> {
    return new ExtensionDomainEntity<TConfig>(
      row.name,
      row.enabled,
      row.config as unknown as TConfig,
      row.created_at,
      row.updated_at,
      row.schema_version
    );
  }
}
