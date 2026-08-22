import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  MARKETPLACE_SUPPLIER_SETTINGS_REPOSITORY,
  type MarketplaceSupplierSettingsDomainRepository,
} from '../../domain/repositories/marketplace-supplier-settings.repository';
import { formatPayoutDestination } from '../shared/payout-destination.util';
import { PAYMENT_METHOD_PORT, type IPaymentMethodPort, type InnerPaymentMethod } from '@coopenomics/innercoop';

export const MARKETPLACE_SUPPLIER_SETTINGS_SERVICE = Symbol(
  'MARKETPLACE_SUPPLIER_SETTINGS_SERVICE'
);

export interface SupplierPaymentSettingsView {
  /** Явный выбор поставщика; null — выбора не было (работает фолбэк). */
  payout_method_id: string | null;
  /** Есть ли реквизиты, на которые реально уйдёт выплата (выбор или фолбэк). */
  has_payout_method: boolean;
  /** Маскированная подпись резолвнутых реквизитов, например «Сбербанк •1234». */
  payout_destination: string | null;
}

/**
 * «Выплаты получаю на…» поставщика стола заказов.
 *
 * Сами реквизиты — платёжные методы ядра (раздел «Реквизиты» стола пайщика);
 * здесь хранится только ссылка-выбор. Резолв метода для выплаты:
 * явный выбор → метод «по умолчанию» из ядра → единственный метод → null.
 * Без резолвабельного метода публикация предложений закрыта гейтом —
 * выплата по акту приёмки не должна рождаться «в никуда».
 */
@Injectable()
export class MarketplaceSupplierSettingsService {
  private readonly logger = new Logger(MarketplaceSupplierSettingsService.name);

  constructor(
    @Inject(MARKETPLACE_SUPPLIER_SETTINGS_REPOSITORY)
    private readonly settingsRepo: MarketplaceSupplierSettingsDomainRepository,
    @Inject(PAYMENT_METHOD_PORT)
    private readonly paymentMethodRepo: IPaymentMethodPort
  ) {}

  async getSettings(coopname: string, username: string): Promise<SupplierPaymentSettingsView> {
    const payout_method_id = await this.settingsRepo.getPayoutMethodId(coopname, username);
    const resolved = await this.resolvePayoutMethod(coopname, username);
    return {
      payout_method_id,
      has_payout_method: resolved != null,
      payout_destination: resolved ? formatPayoutDestination(resolved) : null,
    };
  }

  async setPayoutMethod(
    coopname: string,
    username: string,
    method_id: string
  ): Promise<SupplierPaymentSettingsView> {
    // Метод обязан существовать и принадлежать поставщику — get скоупится
    // по username, чужой method_id сюда не пролезет.
    try {
      await this.paymentMethodRepo.get({ username, method_id });
    } catch {
      throw new BadRequestException(
        'Реквизиты не найдены. Добавьте их в разделе «Реквизиты» стола пайщика и выберите снова.'
      );
    }
    await this.settingsRepo.setPayoutMethodId(coopname, username, method_id);
    return this.getSettings(coopname, username);
  }

  /**
   * Реквизиты, на которые уйдёт следующая выплата поставщику.
   * Если явно выбранный метод уже удалён — тихо падаем на фолбэк
   * (default-метод ядра, затем единственный оставшийся).
   */
  async resolvePayoutMethod(
    coopname: string,
    username: string
  ): Promise<InnerPaymentMethod | null> {
    const selectedId = await this.settingsRepo.getPayoutMethodId(coopname, username);
    if (selectedId) {
      try {
        return await this.paymentMethodRepo.get({ username, method_id: selectedId });
      } catch {
        this.logger.warn(
          `resolvePayoutMethod: выбранный метод ${selectedId} поставщика ${username} не найден — фолбэк на метод по умолчанию.`
        );
      }
    }
    // Пагинация в generator-репозитории методов не работает (известный TODO),
    // поля обязательны по интерфейсу — передаём широкое окно.
    const methods = await this.paymentMethodRepo.list(username, { page: 1, limit: 100, sortOrder: 'ASC' });
    const items = methods.items ?? [];
    return items.find((m) => m.is_default) ?? (items.length === 1 ? items[0] : null);
  }

  /** Гейт публикации: без резолвабельных реквизитов Offer не публикуется. */
  async assertPayoutMethodConfigured(coopname: string, username: string): Promise<void> {
    const resolved = await this.resolvePayoutMethod(coopname, username);
    if (!resolved) {
      throw new BadRequestException(
        'Чтобы публиковать предложения, укажите реквизиты для выплат: добавьте их в разделе «Реквизиты» и выберите на странице «Выплаты» стола поставщика.'
      );
    }
  }
}
