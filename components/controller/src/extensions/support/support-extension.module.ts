import { Inject, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';
import {
  BaseExtensionModule,
  EXTENSION_REPOSITORY,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';

/**
 * Каркас первой фазы: обращение, лента переписки и вложения появятся в
 * следующих фазах и своих переключателей в конфиге расширения не потребуют.
 */
export const Schema = z.object({});
export const defaultConfig = {};
export type IConfig = z.infer<typeof Schema>;

@Injectable()
export class SupportExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    super();
    this.logger.setContext(SupportExtension.name);
  }

  name = 'support';
  extension!: ExtensionDomainEntity<IConfig>;
  configSchemas = Schema;
  defaultConfig = defaultConfig;

  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw new Error('Конфиг стола поддержки не найден');

    this.extension = extensionData;
    this.logger.log('Стол поддержки инициализирован');
  }
}

@Module({
  providers: [SupportExtension],
  exports: [SupportExtension],
})
export class SupportExtensionModule {
  constructor(private readonly supportExtension: SupportExtension) {}

  async initialize() {
    await this.supportExtension.initialize();
  }
}
