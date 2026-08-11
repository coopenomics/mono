import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ExtensionDomainService } from '~/domain/extension/services/extension-domain.service';
import type { IConfig } from '../../types';

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
  private resolved: ExtensionDomainService | null = null;
  private warned = false;

  constructor(private readonly moduleRef: ModuleRef) {}

  private extensionService(): ExtensionDomainService | null {
    if (this.resolved) return this.resolved;
    try {
      this.resolved = this.moduleRef.get(ExtensionDomainService, { strict: false });
    } catch {
      // Один раз на процесс: иначе лог зальётся при каждом обращении.
      if (!this.warned) {
        this.warned = true;
        this.logger.error(
          'ExtensionDomainService недоступен: настройки расширения «Стол заказов» читаться не будут, ' +
            'поведение откатится на значения по умолчанию.'
        );
      }
      return null;
    }
    return this.resolved;
  }

  /** Конфиг расширения; `null` — расширение не установлено либо сервис недоступен. */
  async get(): Promise<IConfig | null> {
    const service = this.extensionService();
    if (!service) return null;
    const extension = await service.getAppByName('market');
    return (extension?.config as IConfig | undefined) ?? null;
  }
}
