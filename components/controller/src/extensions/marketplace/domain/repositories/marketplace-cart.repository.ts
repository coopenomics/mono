import type { MarketplaceCartDomainEntity } from '../entities/marketplace-cart.entity';

export const MARKETPLACE_CART_REPOSITORY = Symbol('MARKETPLACE_CART_REPOSITORY');

/**
 * Эпик 16: репозиторий корзины заказчика. Off-chain CRUD, без интеграции
 * с syncer'ом — корзина существует только в PG. Одна корзина на пару
 * (coopname, orderer_account) гарантируется уникальным индексом; методы
 * чтения/мутации работают через `getOrCreate`.
 */
export interface MarketplaceCartDomainRepository {
  /**
   * Возвращает корзину заказчика, создавая пустую при первом обращении.
   * Всегда с подгруженными позициями.
   */
  getOrCreate(coopname: string, orderer_account: string): Promise<MarketplaceCartDomainEntity>;

  /** Корзина заказчика с позициями или null, если ещё не создавалась. */
  findByOrderer(
    coopname: string,
    orderer_account: string
  ): Promise<MarketplaceCartDomainEntity | null>;

  /**
   * Добавить/долить позицию: если оффер уже в корзине — количество
   * суммируется (слияние одинаковых позиций), иначе создаётся строка.
   */
  upsertItem(cart_id: string, coopname: string, offer_id: string, package_id: string, quantity: number): Promise<void>;

  /** Установить точное количество по офферу+упаковке (например из инпута корзины). */
  setItemQuantity(cart_id: string, offer_id: string, package_id: string, quantity: number): Promise<void>;

  /** Убрать позицию (оффер+упаковку) из корзины. */
  removeItem(cart_id: string, offer_id: string, package_id: string): Promise<void>;

  /** Очистить корзину (все позиции). */
  clear(cart_id: string): Promise<void>;

  /**
   * Убрать набор офферов из корзины одним запросом — используется после
   * успешного оформления, чтобы вынуть прошедшие позиции (остаток для
   * повтора сохраняется).
   */
  removeItems(cart_id: string, offer_ids: string[]): Promise<void>;

  /** Сменить КУ доставки корзины (контекст каталога). */
  setDeliveryBraname(cart_id: string, delivery_braname: string | null): Promise<void>;
}
