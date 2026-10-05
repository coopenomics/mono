
/**
 * Эпик 16: позиция корзины (оффер × количество). Уникальный индекс
 * (cart_id, offer_id, package_id) обеспечивает слияние одинаковых позиций —
 * повторное добавление того же оффера с той же упаковкой доливает количество,
 * а не плодит строки; разные упаковки одного оффера — отдельные строки.
 * Off-chain, DDL через `synchronize`.
 */
export class MarketplaceCartItemEntity {
  public id!: string;

  public cart_id!: string;

  public coopname!: string;

  public offer_id!: string;

  /**
   * Выбранная упаковка каталога оффера (Эпик 18) при отпуске упаковкой; пустая
   * строка `''` при отпуске по мере (участвует в уникальном индексе, поэтому не
   * NULL — иначе Postgres не сольёт одинаковые by_measure-позиции).
   */
  public package_id!: string;

  /**
   * Количество (Эпик 17/18): numeric в базовой единице при отпуске по мере
   * (дробное), либо целое число упаковок при отпуске упаковкой. transformer → number.
   */
  public quantity!: number;

  public created_at!: Date;

  public updated_at!: Date;
}
