import { DynamicModule, Module } from '@nestjs/common';
import { InnercoopBridgeModule } from './innercoop-bridge.module';
import { ChairmanExtensionModule } from './chairman/chairman-extension.module';
import { CapitalExtensionModule } from './capital/capital-extension.module';
import { PowerupExtensionModule } from './powerup/powerup-extension.module';
import { YookassaExtensionModule } from './yookassa/yookassa-extension.module';
import { SberpollExtensionModule } from './sberpoll/sberpoll-extension.module';
import { QrPayExtensionModule } from './qrpay/qrpay-extension.module';
import { BuiltinExtensionModule } from './builtin/builtin-extension.module';
import { ParticipantExtensionModule } from './participant/participant-extension.module';
import { ChatCoopExtensionModule } from './chatcoop/chatcoop-extension.module';
import { ReportsExtensionModule } from './reports/reports-extension.module';
import { MarketplaceExtensionModule } from './marketplace/marketplace-extension.module';
import { ExpensesExtensionModule } from './expenses/expenses-extension.module';
import { KuExtensionModule } from './ku/ku-extension.module';
import { CardcoopExtensionModule } from './cardcoop/cardcoop-extension.module';
import { SovietRobotExtensionModule } from './soviet-robot/soviet-robot-extension.module';

@Module({})
export class ExtensionsModule {
  static register(): DynamicModule {
    // const extensionModules = Object.values(AppRegistry).map((extension) => extension.class);

    return {
      module: ExtensionsModule,
      imports: [
        BuiltinExtensionModule,
        ChairmanExtensionModule,
        CapitalExtensionModule,
        PowerupExtensionModule,
        YookassaExtensionModule,
        SberpollExtensionModule,
        QrPayExtensionModule,
        ParticipantExtensionModule,
        ChatCoopExtensionModule,
        InnercoopBridgeModule,
        ReportsExtensionModule,
        MarketplaceExtensionModule,
        ExpensesExtensionModule,
        KuExtensionModule,
        CardcoopExtensionModule,
        SovietRobotExtensionModule,
      ],
      providers: [],
      // Экспортируем все модули расширений, чтобы их провайдеры были доступны
      // другим модулям приложения через механизм опциональной инъекции
      exports: [
        BuiltinExtensionModule,
        ChairmanExtensionModule,
        CapitalExtensionModule,
        PowerupExtensionModule,
        YookassaExtensionModule,
        SberpollExtensionModule,
        QrPayExtensionModule,
        ParticipantExtensionModule,
        ChatCoopExtensionModule,
        InnercoopBridgeModule,
        ReportsExtensionModule,
        MarketplaceExtensionModule,
        ExpensesExtensionModule,
        KuExtensionModule,
        CardcoopExtensionModule,
        SovietRobotExtensionModule,
      ],
    };
  }
}
