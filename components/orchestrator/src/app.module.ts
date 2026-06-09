import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatewayModule } from './gateway/gateway.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { loadAppConfig } from './config/app-config';
import { SubgraphRegistryEntity } from './gateway/subgraph-registry.entity';

const cfg = loadAppConfig();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: cfg.postgresUrl,
      entities: [SubgraphRegistryEntity],
      // На bootstrap безопасно создаём таблицу — registry — единственный
      // объект, который реально нужен gateway. Прод схему мигрирует
      // отдельная миграция при PR на интеграцию с deploy-pipeline.
      synchronize: true,
    }),
    GatewayModule,
    OrchestratorModule,
  ],
})
export class AppModule {}
