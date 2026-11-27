import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { WatcherModule } from './watcher/watcher.module';
import { CatalogTenantTokenModule } from './watcher/catalog-tenant-token.module';
import { DatabaseModule } from './database/database.module';
import { InternalSecretMiddleware } from './orchestrator/internal-secret.middleware';

@Module({
  imports: [
    DatabaseModule,
    GatewayModule,
    OrchestratorModule,
    CatalogTenantTokenModule,
    WatcherModule,
  ],
})
export class AppModule implements NestModule {
  /** Служебные маршруты — только с секретом узла: оркестратор виден из сети приложений. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(InternalSecretMiddleware).forRoutes('v1/internal');
  }
}
