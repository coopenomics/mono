import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { WatcherModule } from './watcher/watcher.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    DatabaseModule,
    GatewayModule,
    OrchestratorModule,
    WatcherModule,
  ],
})
export class AppModule {}
