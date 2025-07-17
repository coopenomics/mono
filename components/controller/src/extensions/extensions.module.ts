import { DynamicModule, Module } from '@nestjs/common';
import { ChairmanPluginModule } from './chairman/chairman-extension.module';
import { PowerupPluginModule } from './powerup/powerup-extension.module';
import { YookassaPluginModule } from './yookassa/yookassa-extension.module';
import { SberpollPluginModule } from './sberpoll/sberpoll-extension.module';
import { QrPayPluginModule } from './qrpay/qrpay-extension.module';
import { BuiltinPluginModule } from './builtin/builtin-extension.module';
import { ParticipantPluginModule } from './participant/participant-extension.module';
import { MarketplacePluginModule } from './marketplace/marketplace-extension.module';
import { ExtensionDomainModule } from '~/domain/extension/extension-domain.module';

@Module({})
export class ExtensionsModule {
  static register(): DynamicModule {
    // const pluginModules = Object.values(AppRegistry).map((plugin) => plugin.class);

    return {
      module: ExtensionsModule,
      imports: [
        ExtensionDomainModule,
        BuiltinPluginModule,
        ChairmanPluginModule,
        PowerupPluginModule,
        YookassaPluginModule,
        SberpollPluginModule,
        QrPayPluginModule,
        ParticipantPluginModule,
        MarketplacePluginModule,
      ],
      providers: [],
      exports: [],
    };
  }
}
