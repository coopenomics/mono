import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { WatcherModule } from './watcher/watcher.module';
import { CatalogTenantTokenModule } from './watcher/catalog-tenant-token.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    DatabaseModule,
    GatewayModule,
    OrchestratorModule,
    CatalogTenantTokenModule,
    WatcherModule,
  ],
})
export class AppModule {}
