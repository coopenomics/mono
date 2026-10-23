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

/**
 * Ждём, пока ядро начнёт отвечать. Apollo Gateway при создании модуля один
 * раз опрашивает субграф ядра и при отказе роняет запуск. Ядро стартует
 * дольше оркестратора и перезапускается отдельно; под `nest start --watch`
 * упавший процесс сам не поднимается, и шлюз молча пропадает, пока nginx
 * отправляет запросы мимо него в ядро.
 */
async function waitForCore(url: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
      });
      if (res.ok) return;
    } catch {
      // ядро ещё не слушает порт — пробуем снова
    }
    const delayMs = Math.min(1000 * attempt, 10_000);
    if (attempt === 1 || attempt % 10 === 0) {
      // eslint-disable-next-line no-console
      console.log(`[orchestrator] ядро ${url} не отвечает, жду (попытка ${attempt})`);
    }
    // timing: backoff — повтор опроса ядра до его готовности при запуске
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function bootstrap() {
  const cfg = loadAppConfig();
  await prepareDatabase(cfg);
  await waitForCore(cfg.coreSubgraphUrl);

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
