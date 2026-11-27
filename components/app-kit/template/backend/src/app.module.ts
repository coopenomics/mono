import { Module } from '@nestjs/common';
import {
  ExtensionAccessGuard,
  ExtensionConfigError,
  ExtensionFederationModule,
  ExtensionPortsModule,
  HealthController,
  loadExtensionConfig,
} from '@coopenomics/extension-sdk';
import { CoreDemoModule } from './core/core-demo.module';
import { NotesModule } from './notes/notes.module';

const cfg = loadExtensionConfig();
if (!cfg.corePortsUrl || !cfg.corePortsToken) {
  throw new ExtensionConfigError(
    'CORE_PORTS_URL и CORE_PORTS_TOKEN обязательны: приложение работает с ядром по сети',
  );
}

@Module({
  imports: [
    ExtensionFederationModule.forRoot(),
    // Порты ядра по сети. Тот же список стоит в манифесте пакета
    // (package.json → coopenomics.ports): незаявленный порт ядро отклонит.
    ExtensionPortsModule.forRoot({
      coreUrl: cfg.corePortsUrl,
      token: cfg.corePortsToken,
      ports: ['accessToken', 'cooperativeVars', 'document', 'chain'],
    }),
    NotesModule,
    CoreDemoModule,
  ],
  controllers: [HealthController],
  // Проверка пайщика через ядро: секрета ядра у приложения нет.
  providers: [ExtensionAccessGuard],
  exports: [ExtensionAccessGuard],
})
export class AppModule {}
