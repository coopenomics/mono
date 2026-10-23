import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadExtensionConfig } from '@coopenomics/extension-sdk';
import { AppModule } from './app.module';

async function bootstrap() {
  const cfg = loadExtensionConfig();
  const app = await NestFactory.create(AppModule);
  await app.listen(cfg.subgraphPort);
  // eslint-disable-next-line no-console
  console.log(`[hello-subgraph] up at :${cfg.subgraphPort} (coopname=${cfg.coopname})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[hello-subgraph] failed to bootstrap:', err);
  process.exit(1);
});
