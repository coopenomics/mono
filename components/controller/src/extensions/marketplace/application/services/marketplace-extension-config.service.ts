import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IConfig } from '../../types';
import { EXTENSION_CONFIG_PORT, type IExtensionConfigPort } from '@coopenomics/innercoop';

/**
 * Чтение конфига расширения «Стол заказов».
 *
 * Почему через `ModuleRef`, а не обычной инъекцией: ``
 * нельзя импортировать в модуль расширения — получается цикл
 * `AppModule → → ExtensionsModule → MarketplaceExtensionModule
 * → MarketplaceExtensionApplicationModule`. Прежний обход — `@Optional()`
 * инъекция — цикл действительно разрывал, но молча подставлял `null`: сервис
 * никогда не видел конфига и всегда отдавал значения по умолчанию. Для
 * настроек с дефолтом «выключено» это означало, что включённая галочка не
 * действовала вообще (Эпик 19).
 *
 * `ModuleRef` с `strict: false` резолвит провайдер из всего контейнера уже
 * после сборки графа модулей — цикла не возникает, а конфиг настоящий.
 */
@Injectable()
export class MarketplaceExtensionConfigService {
  private readonly logger = new Logger(MarketplaceExtensionConfigService.name);

  constructor(@Inject(EXTENSION_CONFIG_PORT) private readonly extensionConfig: IExtensionConfigPort) {}

  /** Конфиг расширения; `null` — расширение не установлено либо сервис недоступен. */
  async get(): Promise<IConfig | null> {
    return this.extensionConfig.get<IConfig>('market');
  }
}
