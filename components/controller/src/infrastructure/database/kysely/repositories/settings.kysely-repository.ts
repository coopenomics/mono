import { Inject, Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';
import type { SettingsRepository } from '~/domain/settings/repositories/settings.repository';
import type { SettingsDomainInterface } from '~/domain/settings/interfaces/settings-domain.interface';
import type { UpdateSettingsInputDomainInterface } from '~/domain/settings/interfaces/update-settings-input-domain.interface';
import { SettingsDomainEntity } from '~/domain/settings/entities/settings-domain.entity';
import type { Settings } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

/** Настройки кооператива (таблица `settings`). */
@Injectable()
export class SettingsKyselyRepository implements SettingsRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async get(coopname: string): Promise<SettingsDomainInterface | null> {
    const row = await this.db.selectFrom('settings').selectAll().where('coopname', '=', coopname).executeTakeFirst();
    return row ? this.toDomain(row) : null;
  }

  async upsert(settings: SettingsDomainInterface): Promise<SettingsDomainInterface> {
    // Колонку extra_settings домен не ведёт: при вставке её заполняет умолчание базы, при правке она не трогается.
    const values = {
      coopname: settings.coopname,
      provider_name: settings.provider_name,
      authorized_default_workspace: settings.authorized_default_workspace,
      authorized_default_route: settings.authorized_default_route,
      non_authorized_default_workspace: settings.non_authorized_default_workspace,
      non_authorized_default_route: settings.non_authorized_default_route,
    };
    const row = await this.db
      .insertInto('settings')
      .values(values)
      .onConflict((conflict) => conflict.column('coopname').doUpdateSet({ ...values, updated_at: sql`now()` }))
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toDomain(row);
  }

  async update(coopname: string, updates: UpdateSettingsInputDomainInterface): Promise<SettingsDomainInterface> {
    const existing = await this.get(coopname);
    if (!existing) {
      throw new Error(`Settings not found for coopname: ${coopname}`);
    }
    // Обновляются только переданные поля.
    return this.upsert({ ...existing, ...updates, updated_at: new Date() });
  }

  private toDomain(row: Selectable<Settings>): SettingsDomainInterface {
    return new SettingsDomainEntity({
      coopname: row.coopname,
      provider_name: row.provider_name,
      authorized_default_workspace: row.authorized_default_workspace,
      authorized_default_route: row.authorized_default_route,
      non_authorized_default_workspace: row.non_authorized_default_workspace,
      non_authorized_default_route: row.non_authorized_default_route,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
