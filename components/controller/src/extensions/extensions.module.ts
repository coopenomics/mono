import { DynamicModule, Module } from '@nestjs/common';
import { InterCommunicationBridgeModule } from './inter-communication-bridge.module';
import { ChairmanPluginModule } from './chairman/chairman-extension.module';
import { CapitalPluginModule } from './capital/capital-extension.module';
import { PowerupPluginModule } from './powerup/powerup-extension.module';
import { YookassaPluginModule } from './yookassa/yookassa-extension.module';
import { SberpollPluginModule } from './sberpoll/sberpoll-extension.module';
import { QrPayPluginModule } from './qrpay/qrpay-extension.module';
import { BuiltinPluginModule } from './builtin/builtin-extension.module';
import { ParticipantPluginModule } from './participant/participant-extension.module';
import { ChatCoopPluginModule } from './chatcoop/chatcoop-extension.module';
import { OneCoopPluginModule } from './1ccoop/oneccoop-extension.module';
import { ReportsExtensionModule } from './reports/reports-extension.module';
import { AppsCatalogProxyModule } from './apps-catalog-proxy/apps-catalog-proxy.module';
import { ExtensionDomainModule } from '~/domain/extension/extension-domain.module';
import { GatewayDomainModule } from '~/domain/gateway/gateway-domain.module';

@Module({})
export class ExtensionsModule {
  static register(): DynamicModule {
    // const pluginModules = Object.values(AppRegistry).map((plugin) => plugin.class);

    return {
      module: ExtensionsModule,
      imports: [
        ExtensionDomainModule,
        GatewayDomainModule,
        BuiltinPluginModule,
        ChairmanPluginModule,
        CapitalPluginModule,
        PowerupPluginModule,
        YookassaPluginModule,
        SberpollPluginModule,
        QrPayPluginModule,
        ParticipantPluginModule,
        ChatCoopPluginModule,
        InterCommunicationBridgeModule,
        OneCoopPluginModule,
        ReportsExtensionModule,
        AppsCatalogProxyModule,
      ],
      providers: [],
      // Экспортируем все модули расширений, чтобы их провайдеры были доступны
      // другим модулям приложения через механизм опциональной инъекции
      exports: [
        BuiltinPluginModule,
        ChairmanPluginModule,
        CapitalPluginModule,
        PowerupPluginModule,
        YookassaPluginModule,
        SberpollPluginModule,
        QrPayPluginModule,
        ParticipantPluginModule,
        ChatCoopPluginModule,
        InterCommunicationBridgeModule,
        OneCoopPluginModule,
        ReportsExtensionModule,
        AppsCatalogProxyModule,
      ],
    };
  }
}
