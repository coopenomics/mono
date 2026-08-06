import { Injectable, Optional } from '@nestjs/common';
import { ExtensionDomainService } from '~/domain/extension/services/extension-domain.service';
import { defaultConfig, type IConfig, type IWarehouseConfig } from '../../types';

/**
 * Настройки адресного хранения из конфига расширения «Стол заказов» (Эпик 19).
 *
 * Единая точка чтения: их спрашивают и контекст пайщика (чтобы интерфейс не
 * показывал боксы там, где кооператив их не включал), и приёмка (чтобы решить,
 * обязательно ли указывать место при закрывающей подписи).
 *
 * Дефолты — «всё выключено»: если расширение ещё не проинициализировано или
 * конфиг частично пуст, склад ведёт себя как до эпика, а не падает.
 */
@Injectable()
export class MarketplaceWarehouseSettingsService {
  constructor(
    @Optional()
    private readonly extensionDomainService: ExtensionDomainService | null
  ) {}

  async get(): Promise<IWarehouseConfig> {
    const extension = this.extensionDomainService
      ? await this.extensionDomainService.getAppByName('market')
      : null;
    const cfg = extension?.config as IConfig | undefined;
    const fallback = defaultConfig.warehouse;

    return {
      containers_enabled: cfg?.warehouse?.containers_enabled ?? fallback.containers_enabled,
      cells_enabled: cfg?.warehouse?.cells_enabled ?? fallback.cells_enabled,
      posting_on_reception_required:
        cfg?.warehouse?.posting_on_reception_required ?? fallback.posting_on_reception_required,
    };
  }
}
