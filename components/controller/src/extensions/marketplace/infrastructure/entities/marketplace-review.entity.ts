import type { MarketplaceReviewStatus } from '../../domain/entities/marketplace-review.types';

/** Запись таблицы `marketplace_review` — отзыв заказчика по полученному заказу. */
export class MarketplaceReviewEntity {
  public id!: string;

  public coopname!: string;

  /** Заказ, по которому оставлен отзыв; на заказ отзыв один. */
  public order_id!: string;

  public offer_id!: string;

  public supplier_account!: string;

  public author_account!: string;

  public stars!: number;

  public text!: string;

  public status!: MarketplaceReviewStatus;

  public hidden_by!: string | null;

  public hidden_at!: Date | null;

  public hidden_reason!: string | null;

  public created_at!: Date;

  public updated_at!: Date;
}
