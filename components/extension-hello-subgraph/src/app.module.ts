import { Module } from '@nestjs/common';
import {
  ExtensionFederationModule,
  HealthController,
  loadExtensionConfig,
} from '@coopenomics/extension-sdk';
import { HelloResolver } from './hello.resolver';

// Проверка окружения при старте: без SUBGRAPH_PORT и COOPNAME контейнер не запускается.
loadExtensionConfig();

@Module({
  imports: [
    // Защищённых запросов у примера нет, поэтому проверка пайщика не подключена.
    // Приложению с такими запросами — ExtensionPortsModule и ExtensionAccessGuard:
    // пайщика опознаёт ядро, секрет ядра приложению не передаётся.
    ExtensionFederationModule.forRoot(),
  ],
  controllers: [HealthController],
  providers: [HelloResolver],
})
export class AppModule {}
