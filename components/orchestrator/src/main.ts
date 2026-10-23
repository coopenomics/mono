import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadAppConfig } from './config/app-config';
import { createOrchestratorDb } from './database/database.module';
import { runOrchestratorMigrations } from './database/migrations';
import { upsertSubgraph } from './gateway/subgraph-registry.service';

/**
 * Перед стартом Apollo Gateway применяем миграции схемы и записываем
 * core-subgraph в реестр, иначе IntrospectAndCompose упадёт с «пустой
 * registry».
 *
 * Делается отдельным соединением (минуя Nest DI), чтобы схема и запись
 * ядра точно были готовы ДО запуска GraphQLModule.forRootAsync.
 */
async function prepareDatabase(cfg: ReturnType<typeof loadAppConfig>) {
  const db = createOrchestratorDb(cfg.postgresUrl);
  try {
    const applied = await runOrchestratorMigrations(db);
    if (applied.length) {
      // eslint-disable-next-line no-console
      console.log(`[orchestrator] миграции схемы применены: ${applied.join(', ')}`);
    }
    await upsertSubgraph(db, 'core@coopback', 'monolith', cfg.coreSubgraphUrl);
  } finally {
    await db.destroy();
  }
}

async function bootstrap() {
  const cfg = loadAppConfig();
  await prepareDatabase(cfg);

  const app = await NestFactory.create(AppModule);
  await app.listen(cfg.port);
  // eslint-disable-next-line no-console
  console.log(
    `[orchestrator] up at :${cfg.port} ` +
      `(coopname=${cfg.coopname}, core=${cfg.coreSubgraphUrl})`,
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[orchestrator] failed to bootstrap:', err);
  process.exit(1);
});
