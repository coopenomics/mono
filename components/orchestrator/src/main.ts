import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { loadAppConfig } from './config/app-config';
import { SubgraphRegistryEntity } from './gateway/subgraph-registry.entity';

/**
 * Перед стартом Apollo Gateway seed'им запись core-subgraph'а в registry,
 * иначе IntrospectAndCompose упадёт с "пустой registry".
 *
 * Bootstrap делается в отдельной DataSource (минуя Nest DI), чтобы быть
 * уверенным что seed произошёл ДО запуска GraphQLModule.forRootAsync.
 */
async function seedCoreSubgraph(cfg: ReturnType<typeof loadAppConfig>) {
  const ds = new DataSource({
    type: 'postgres',
    url: cfg.postgresUrl,
    entities: [SubgraphRegistryEntity],
    synchronize: true,
  });
  await ds.initialize();
  const repo = ds.getRepository(SubgraphRegistryEntity);
  await repo.upsert(
    {
      packageId: 'core@coopback',
      version: 'monolith',
      url: cfg.coreSubgraphUrl,
      active: true,
      healthStatus: 'unknown',
    },
    ['packageId'],
  );
  await ds.destroy();
}

async function bootstrap() {
  const cfg = loadAppConfig();
  await seedCoreSubgraph(cfg);

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
