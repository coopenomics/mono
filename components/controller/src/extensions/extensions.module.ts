import { DynamicModule, Module, Logger } from '@nestjs/common';
import { ChairmanPluginModule } from './chairman/chairman-extension.module';
import { PowerupPluginModule } from './powerup/powerup-extension.module';
import { YookassaPluginModule } from './yookassa/yookassa-extension.module';
import { SberpollPluginModule } from './sberpoll/sberpoll-extension.module';
import { QrPayPluginModule } from './qrpay/qrpay-extension.module';
import { BuiltinPluginModule } from './builtin/builtin-extension.module';
import { ParticipantPluginModule } from './participant/participant-extension.module';
import { ChatCoopPluginModule } from './chatcoop/chatcoop-extension.module';
import { OneCoopPluginModule } from './1ccoop/oneccoop-extension.module';
import { ExtensionDomainModule } from '~/domain/extension/extension-domain.module';
import { GatewayDomainModule } from '~/domain/gateway/gateway-domain.module';

const logger = new Logger('ExtensionsModule');

/**
 * Попытка загрузить capital как внешний пакет @coopenomics/ext-capital.
 * Если пакет не установлен — capital пропускается (graceful degradation).
 */
function tryLoadCapital(): any | null {
  try {
    const capitalExt = require('@coopenomics/ext-capital');
    const mod = capitalExt.default || capitalExt;
    if (mod.getBackendModule) {
      logger.log('Расширение Capital загружено из @coopenomics/ext-capital');
      return mod.getBackendModule();
    }
    if (capitalExt.CapitalPluginModule) {
      logger.log('Расширение Capital загружено (legacy export)');
      return capitalExt.CapitalPluginModule;
    }
  } catch {
    // Пакет не установлен — fallback на встроенный
  }

  try {
    const { CapitalPluginModule } = require('./capital/capital-extension.module');
    logger.log('Расширение Capital загружено из встроенного ядра');
    return CapitalPluginModule;
  } catch {
    logger.warn('Расширение Capital не найдено — ни как пакет, ни встроенное');
    return null;
  }
}

@Module({})
export class ExtensionsModule {
  static register(): DynamicModule {
    const coreModules = [
      ExtensionDomainModule,
      GatewayDomainModule,
      BuiltinPluginModule,
      ChairmanPluginModule,
      PowerupPluginModule,
      YookassaPluginModule,
      SberpollPluginModule,
      QrPayPluginModule,
      ParticipantPluginModule,
      ChatCoopPluginModule,
      OneCoopPluginModule,
    ];

    const capitalModule = tryLoadCapital();
    if (capitalModule) {
      coreModules.push(capitalModule);
    }

    return {
      module: ExtensionsModule,
      imports: coreModules,
      providers: [],
      exports: coreModules,
    };
  }
}
