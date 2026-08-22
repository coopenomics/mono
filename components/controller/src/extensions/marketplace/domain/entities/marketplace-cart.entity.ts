import type {
  MarketplaceCartItemProps,
  MarketplaceCartProps,
} from './marketplace-cart.types';

/**
 * Эпик 16: позиция корзины — оффер + количество. Денормализованный
 * `coopname` повторяет коопнейм корзины (упрощает scoped-запросы).
 */
export class MarketplaceCartItemDomainEntity {
  public readonly id: string;
  public readonly cart_id: string;
  public readonly coopname: string;
  public readonly offer_id: string;
  /** Выбранная упаковка (Эпик 18); пустая строка при отпуске по мере. */
  public readonly package_id: string;
  public readonly quantity: number;
  public readonly created_at: Date;
  public readonly updated_at: Date;

  constructor(props: MarketplaceCartItemProps) {
    this.id = props.id;
    this.cart_id = props.cart_id;
    this.coopname = props.coopname;
    this.offer_id = props.offer_id;
    this.package_id = props.package_id ?? '';
    this.quantity = props.quantity;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }
}

/**
 * Эпик 16: корзина заказчика как агрегат позиций. Off-chain. Привязана к
 * текущему КУ доставки — оформление (checkout) штампует все строки общим
 * `checkout_id` и этим КУ (инвариант «один заказ — один КУ»).
 */
export class MarketplaceCartDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly orderer_account: string;
  public readonly delivery_braname: string | null;
  public readonly items: MarketplaceCartItemDomainEntity[];
  public readonly created_at: Date;
  public readonly updated_at: Date;

  constructor(props: MarketplaceCartProps) {
    this.id = props.id;
    this.coopname = props.coopname;
    this.orderer_account = props.orderer_account;
    this.delivery_braname = props.delivery_braname;
    this.items = props.items.map((i) => new MarketplaceCartItemDomainEntity(i));
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  /** Кол-во разных позиций (строк) в корзине. */
  public get positions_count(): number {
    return this.items.length;
  }

  /** Суммарное кол-во единиц всех позиций. */
  public get total_quantity(): number {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  public get is_empty(): boolean {
    return this.items.length === 0;
  }
}
