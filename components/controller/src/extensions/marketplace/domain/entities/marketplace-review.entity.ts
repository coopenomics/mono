import type { MarketplaceReviewStatus } from './marketplace-review.types';

/** Отзыв заказчика по полученному заказу. Живёт в базе узла, в цепь не пишется. */
export class MarketplaceReviewDomainEntity {
  public readonly id!: string;
  public readonly coopname!: string;
  public readonly order_id!: string;
  public readonly offer_id!: string;
  /** Поставщик на момент заказа — копия из заказа, по ней собирается сводка поставщика. */
  public readonly supplier_account!: string;
  public readonly author_account!: string;
  public readonly stars!: number;
  public readonly text!: string;
  public readonly status!: MarketplaceReviewStatus;
  public readonly hidden_by!: string | null;
  public readonly hidden_at!: Date | null;
  public readonly hidden_reason!: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  constructor(init: {
    id: string;
    coopname: string;
    order_id: string;
    offer_id: string;
    supplier_account: string;
    author_account: string;
    stars: number;
    text: string;
    status: MarketplaceReviewStatus;
    hidden_by: string | null;
    hidden_at: Date | null;
    hidden_reason: string | null;
    created_at: Date;
    updated_at: Date;
  }) {
    this.id = init.id;
    this.coopname = init.coopname;
    this.order_id = init.order_id;
    this.offer_id = init.offer_id;
    this.supplier_account = init.supplier_account;
    this.author_account = init.author_account;
    this.stars = init.stars;
    this.text = init.text;
    this.status = init.status;
    this.hidden_by = init.hidden_by;
    this.hidden_at = init.hidden_at;
    this.hidden_reason = init.hidden_reason;
    this.created_at = init.created_at;
    this.updated_at = init.updated_at;
  }
}
