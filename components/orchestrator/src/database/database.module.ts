import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { loadAppConfig } from '../config/app-config';
import type { OrchestratorDB } from './database.types';

/** Токен соединения Kysely с базой кооператива. */
export const ORCHESTRATOR_DB = Symbol('Orchestrator.Database');

export function createOrchestratorDb(postgresUrl: string): Kysely<OrchestratorDB> {
  return new Kysely<OrchestratorDB>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString: postgresUrl, max: 5 }) }),
  });
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
