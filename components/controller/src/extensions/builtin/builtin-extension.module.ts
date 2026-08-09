import { Inject, Module } from '@nestjs/common';
import { EXTENSION_REPOSITORY, type ExtensionDomainRepository, BaseExtensionModule } from '@coopenomics/extension-kit';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { z } from 'zod';
// Дефолтные параметры конфигурации
export const defaultConfig = {};

export const Schema = z.object({});

// Интерфейс для параметров конфигурации расширения
export type IConfig = z.infer<typeof Schema>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILog {}

export class BuiltinExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    private readonly logger: WinstonLoggerService
  ) {
    super();
    this.logger.setContext(BuiltinExtension.name);
  }

  name = 'builtin';
  extension!: ExtensionDomainEntity<IConfig>;

  async initialize(): Promise<void> {
    //nothing
  }

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;
}

@Module({
  providers: [BuiltinExtension], // Регистрируем SberpollExtension как провайдер
  exports: [BuiltinExtension], // Экспортируем его для доступа в других модулях
})
export class BuiltinExtensionModule {
  constructor(private readonly builtinExtension: BuiltinExtension) {}

  async initialize() {
    await this.builtinExtension.initialize();
  }
}
