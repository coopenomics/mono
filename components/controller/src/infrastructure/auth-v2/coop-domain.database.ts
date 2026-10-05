import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { rawQuery } from '@coopenomics/extension-kit';
import config from '~/config/config';
import type { ICoopDomainDatabase } from '~/domain/auth-v2/ports/coop-domain-database.port';

/**
 * Соединение с базой CoopID — одно на все её хранилища. Подключение ленивое:
 * настройки базы читаются и соединение открывается на первом запросе, поэтому
 * недоступная база либо отсутствие её секрета бьёт только по вызывающему, а
 * запуск узла от неё не зависит.
 */
@Injectable()
export class CoopDomainDatabase implements ICoopDomainDatabase, OnModuleDestroy {
  private readonly logger = new Logger(CoopDomainDatabase.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: Kysely<any> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private connection(): Kysely<any> {
    if (this.db) return this.db;
    const pool = new Pool({
      host: config.coopDomainDb.host,
      port: config.coopDomainDb.port,
      user: config.coopDomainDb.username,
      password: config.coopDomainDb.password,
      database: config.coopDomainDb.database,
    });
    // Обрыв простаивающего соединения пул сообщает событием; без слушателя оно уронило бы процесс.
    pool.on('error', (error) => this.logger.warn(`coop_domain_db idle connection error: ${error.message}`));
    this.db = new Kysely({ dialect: new PostgresDialect({ pool }) });
    return this.db;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<TRow = any>(text: string, parameters: readonly unknown[] = []): Promise<TRow[]> {
    return rawQuery<TRow>(this.connection(), text, parameters);
  }

  async onModuleDestroy(): Promise<void> {
    await this.db?.destroy();
    this.db = null;
  }
}
