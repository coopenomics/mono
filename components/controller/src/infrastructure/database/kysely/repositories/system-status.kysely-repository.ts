import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { MonoStatusRepository } from '~/domain/common/repositories/mono-status.repository';
import type { SystemStatusDomainType } from '~/domain/system/interfaces/system-status-domain.types';
import config from '~/config/config';
import { SystemStatus } from '~/application/system/dto/system-status.dto';
import type { SystemStatusStatusEnum } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

/** Состояние узла кооператива: установка, код установки (таблица `system_status`). */
@Injectable()
export class SystemStatusKyselyRepository implements MonoStatusRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async getStatus(): Promise<SystemStatusDomainType> {
    const row = await this.db.selectFrom('system_status').select('status').where('coopname', '=', config.coopname).executeTakeFirst();
    if (!row || !row.status) return SystemStatus.install;
    return row.status as SystemStatusDomainType;
  }

  async setStatus(status: SystemStatusDomainType): Promise<void> {
    await this.upsert({ status: status as SystemStatusStatusEnum });
  }

  async createInstallStatus(): Promise<void> {
    await this.upsert({ status: SystemStatus.install as SystemStatusStatusEnum });
  }

  async setInstallCode(code: string, expiresAt: Date): Promise<void> {
    await this.upsert({ install_code: code, install_code_expires_at: expiresAt });
  }

  async validateInstallCode(code: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('system_status')
      .select('coopname')
      .where('coopname', '=', config.coopname)
      .where('install_code', '=', code)
      .where('install_code_expires_at', '>', new Date())
      .executeTakeFirst();
    return !!row;
  }

  async getMonoDocument(): Promise<any> {
    const row = await this.db.selectFrom('system_status').selectAll().where('coopname', '=', config.coopname).executeTakeFirst();
    if (!row) return null;
    return {
      coopname: row.coopname,
      status: row.status,
      install_code: row.install_code,
      install_code_expires_at: row.install_code_expires_at,
      init_by_server: row.init_by_server,
    };
  }

  async setInitByServer(initByServer: boolean): Promise<void> {
    await this.upsert({ init_by_server: initByServer });
  }

  /** Строка состояния у узла одна: правятся только переданные поля. */
  private async upsert(fields: {
    status?: SystemStatusStatusEnum;
    install_code?: string;
    install_code_expires_at?: Date;
    init_by_server?: boolean;
  }): Promise<void> {
    await this.db
      .insertInto('system_status')
      .values({ coopname: config.coopname, ...fields })
      .onConflict((conflict) => conflict.column('coopname').doUpdateSet({ ...fields, updated_at: sql`now()` }))
      .execute();
  }
}
