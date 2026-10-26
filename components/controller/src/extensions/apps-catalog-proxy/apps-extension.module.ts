import './i18n';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_RIGHTS, RightsGuard } from '@coopenomics/extension-kit';
import { AppsCatalogProxyModule } from './apps-catalog-proxy.module';
import { AppsExtension } from './apps-extension';
import { AppsRights } from './application/access/apps-rights';
import { NodeAppsService } from './application/services/node-apps.service';
import { AppsResolver } from './application/resolvers/apps.resolver';

/**
 * Модуль расширения «apps» («Приложения»): витрина, подписки и переключатель
 * приложений каталога на узле. Канал к каталогу и состояние приложений
 * берёт у `AppsCatalogProxyModule` (та же папка расширения).
 */
@Module({
  imports: [ConfigModule, AppsCatalogProxyModule],
  providers: [
    AppsExtension,
    NodeAppsService,
    AppsResolver,
    AppsRights,
    { provide: APP_RIGHTS, useExisting: AppsRights },
    RightsGuard,
  ],
  exports: [AppsExtension],
})
export class AppsExtensionModule {
  constructor(private readonly appsExtension: AppsExtension) {}

  /** Ядро вызывает initialize у экземпляра модуля при установке и включении расширения. */
  async initialize(): Promise<void> {
    await this.appsExtension.initialize();
  }
}
