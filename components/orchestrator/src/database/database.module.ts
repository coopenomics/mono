import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { loadAppConfig } from '../config/app-config';
import type { OrchestratorDB } from './database.types';

/** Токен соединения Kysely с базой кооператива. */
export const ORCHESTRATOR_DB = Symbol('Orchestrator.Database');

export function createOrchestratorDb(postgresUrl: string): Kysely<OrchestratorDB> {
  const pool = new Pool({ connectionString: postgresUrl, max: 5 });
  // Обрыв простаивающего соединения (перезапуск PostgreSQL, «terminating
  // connection due to administrator command») приходит событием error.
  // Без слушателя Node роняет процесс, а ts-node-dev в dev-режиме держит
  // контейнер «живым» без слушающего порта (25.10.2026: оркестратор хаба
  // сутки не принимал tenant JWT и не ставил приложения). Соединение
  // пересоздаст сам pool при следующем запросе.
  pool.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.warn(`[orchestrator] postgres idle connection error: ${error.message}`);
  });
  return new Kysely<OrchestratorDB>({ dialect: new PostgresDialect({ pool }) });
}

/**
 * Соединение с базой для реестра субграфов. Схему создают миграции на
 * старте сервиса (`main.ts`), до подъёма Nest: gateway читает реестр сразу.
 */
@Global()
@Module({
  providers: [
    {
      provide: ORCHESTRATOR_DB,
      useFactory: () => createOrchestratorDb(loadAppConfig().postgresUrl),
    },
  ],
  exports: [ORCHESTRATOR_DB],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(ORCHESTRATOR_DB) private readonly db: Kysely<OrchestratorDB>) {}

  async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }
}
