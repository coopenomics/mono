
/**
 * Эпик 16: корзина заказчика. Одна на пару (coopname, orderer_account) —
 * гарантируется уникальным индексом. Off-chain, DDL через `synchronize`.
 */
export class MarketplaceCartEntity {
  public id!: string;

  public coopname!: string;

  public orderer_account!: string;

  /** Текущий КУ доставки корзины (branch.name); null — пока не выбран. */
  public delivery_braname!: string | null;

  public created_at!: Date;

  public updated_at!: Date;
}
