import { Inject, Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';
import { ExtensionDomainRepository, ExtensionDomainEntity, DomainError } from '@coopenomics/extension-kit';
import type { Extensions } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';
import type { ExtensionUninstalledRepository } from '~/domain/extension/repositories/extension-uninstalled.repository';

/**
 * Установленные расширения кооператива и их настройки (таблица `extensions`).
 * По настройкам живут шаги подключения расширений и рабочий стол; сигнал ленты
 * изменений о записи шлёт слой базы.
 *
 * Удаление мягкое (решение владельца 24.11.2026): `deleteByName` ставит
 * `uninstalled_at` и выключает расширение, запись и `config` остаются — в нём
 * отметки онбординга (решения совета), учёт собраний, служебные даты. Для
 * чтений и правок через контракт каркаса удалённой записи нет: «строка есть —
 * установлено» остаётся верным для всех расширений. Повторная установка
 * (`create`) снимает отметку и продолжает с сохранённого `config`.
 */
@Injectable()
export class ExtensionKyselyRepository<TConfig = any>
  implements ExtensionDomainRepository<TConfig>, ExtensionUninstalledRepository<TConfig>
{
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findByName(name: string): Promise<ExtensionDomainEntity<TConfig> | null> {
    const row = await this.db
      .selectFrom('extensions')
      .selectAll()
      .where('name', '=', name)
      .where('uninstalled_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toDomain(row) : null;
  }

  async findUninstalledByName(name: string): Promise<ExtensionDomainEntity<TConfig> | null> {
    const row = await this.db
      .selectFrom('extensions')
      .selectAll()
      .where('name', '=', name)
      .where('uninstalled_at', 'is not', null)
      .executeTakeFirst();
    return row ? this.toDomain(row) : null;
  }

  async findUninstalled(): Promise<ExtensionDomainEntity<TConfig>[]> {
    const rows = await this.db
      .selectFrom('extensions')
      .selectAll()
      .where('uninstalled_at', 'is not', null)
      .execute();
    return rows.map((row) => this.toDomain(row));
  }

  /** Мягкое удаление: отметка времени и выключение, запись и настройки остаются */
  async deleteByName(name: string): Promise<boolean> {
    const rows = await this.db
      .updateTable('extensions')
      .set({ uninstalled_at: sql`now()`, enabled: false, updated_at: sql`now()` })
      .where('name', '=', name)
      .where('uninstalled_at', 'is', null)
      .returningAll()
      .execute();
    return rows.length > 0;
  }

  async create(data: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>> {
    const values = {
      name: data.name as string,
      enabled: data.enabled,
      config: JSON.stringify(data.config ?? {}),
      schema_version: (data as { schema_version?: number }).schema_version ?? 1,
    };
    // Повторная установка удалённого расширения: отметка снимается, к
    // сохранённому config добавляется пришедший с формы (его ключи главнее),
    // поэтому отметки онбординга и служебное состояние переживают удаление.
    // Версия схемы остаётся прежней — штатные миграции настроек при запуске
    // расширения доводят сохранённый config до текущей.
    const row = await this.db
      .insertInto('extensions')
      .values(values)
      .onConflict((conflict) =>
        conflict.column('name').doUpdateSet({
          enabled: values.enabled,
          config: sql`COALESCE("extensions"."config", '{}'::jsonb) || excluded.config`,
          uninstalled_at: null,
          updated_at: sql`now()`,
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toDomain(row);
  }

  /** Без фильтра — все расширения: каталог вызывает поиск без условий. */
  async find(filter?: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>[]> {
    let query = this.db.selectFrom('extensions').selectAll().where('uninstalled_at', 'is', null);
    if (filter?.name != null) query = query.where('name', '=', filter.name);
    if (filter?.enabled != null) query = query.where('enabled', '=', filter.enabled);
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
      .where('uninstalled_at', 'is', null)
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
      .where('uninstalled_at', 'is', null)
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
