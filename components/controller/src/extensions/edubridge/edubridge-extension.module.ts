import { Inject, Module } from '@nestjs/common';
import { merge } from 'lodash';
import {
  BaseExtensionModule,
  EXTENSION_REPOSITORY,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from './constants/edubridge.constants';
import { EdubridgeApplicationModule } from './application/edubridge-application.module';
import { EdubridgeConfigHolder } from './application/config/edubridge-config.holder';
import { defaultConfig, type IConfig, Schema } from './types';

/**
 * Расширение «Образовательный мост» (edubridge).
 *
 * Соединяет кооператив с образовательными площадками: каталог курсов,
 * вступление по офертам родителя-слушателя и преподавателя, членские взносы
 * через конвертацию паевого, автоматическая выдача и отзыв доступа,
 * преподавательский контур (ДУХД, взносы РИД).
 */
export class EdubridgeExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly configHolder: EdubridgeConfigHolder
  ) {
    super();
    this.logger.setContext(EdubridgeExtension.name);
  }

  name = EDUBRIDGE_EXTENSION_NAME;
  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw new Error('Конфиг расширения edubridge не найден');
    this.extension = { ...extensionData, config: merge({}, defaultConfig, extensionData.config) };
    this.configHolder.set(this.extension.config);
    this.logger.info('edubridge-extension готов');
  }
}

@Module({
  imports: [EdubridgeApplicationModule],
  providers: [EdubridgeExtension],
  exports: [EdubridgeExtension],
})
export class EdubridgeExtensionModule {
  constructor(private readonly edubridgeExtension: EdubridgeExtension) {}

  async initialize() {
    await this.edubridgeExtension.initialize();
  }
}
