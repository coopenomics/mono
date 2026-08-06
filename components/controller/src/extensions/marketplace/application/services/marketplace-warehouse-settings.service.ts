import { Injectable } from '@nestjs/common';
import { defaultConfig, type IWarehouseConfig } from '../../types';
import { MarketplaceExtensionConfigService } from './marketplace-extension-config.service';

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
  constructor(private readonly extensionConfig: MarketplaceExtensionConfigService) {}

  async get(): Promise<IWarehouseConfig> {
    const cfg = await this.extensionConfig.get();
    const fallback = defaultConfig.warehouse;

    return {
      containers_enabled: cfg?.warehouse?.containers_enabled ?? fallback.containers_enabled,
      cells_enabled: cfg?.warehouse?.cells_enabled ?? fallback.cells_enabled,
      posting_on_reception_required:
        cfg?.warehouse?.posting_on_reception_required ?? fallback.posting_on_reception_required,
    };
  }
}
