/**
 * Эпик 16: корзина заказчика — серверный накопитель позиций перед
 * оформлением заказа. Off-chain (не синхронизируется с блокчейном):
 * корзина — это намерение, заказ появляется только при checkout'е.
 *
 * Одна корзина на пару (coopname, orderer_account), привязана к текущему
 * КУ доставки (`delivery_braname`). Смена КУ меняет контекст каталога —
 * позиции, недоступные на новом КУ, помечаются на чтении (см. сервис).
 */
export interface MarketplaceCartItemProps {
  id: string;
  cart_id: string;
  coopname: string;
  offer_id: string;
  /** Выбранная упаковка (Эпик 18); пустая строка при отпуске по мере. */
  package_id: string;
  quantity: number;
  created_at: Date;
  updated_at: Date;
}

export interface MarketplaceCartProps {
  id: string;
  coopname: string;
  orderer_account: string;
  /** Текущий КУ доставки корзины (branch.name); null — пока не выбран. */
  delivery_braname: string | null;
  items: MarketplaceCartItemProps[];
  created_at: Date;
  updated_at: Date;
}
