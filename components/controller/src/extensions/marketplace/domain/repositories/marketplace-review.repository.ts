import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { MarketplaceReviewDomainEntity } from '../entities/marketplace-review.entity';
import type {
  MarketplaceReviewRating,
  MarketplaceReviewStatus,
  MarketplaceReviewSummary,
} from '../entities/marketplace-review.types';

export const MARKETPLACE_REVIEW_REPOSITORY = Symbol('MARKETPLACE_REVIEW_REPOSITORY');

export interface ReviewListFilter {
  coopname: string;
  offer_id?: string;
  supplier_account?: string;
  author_account?: string;
  /** Не задан — отзывы любого статуса. */
  status?: MarketplaceReviewStatus;
  /** Подстрока текста отзыва, без учёта регистра. */
  search?: string;
}

export interface ReviewCreateInput {
  coopname: string;
  order_id: string;
  offer_id: string;
  supplier_account: string;
  author_account: string;
  stars: number;
  text: string;
}

/** Чей это объект сводки: предложение либо поставщик. */
export type ReviewSummaryTarget = { offer_id: string } | { supplier_account: string };

export interface MarketplaceReviewDomainRepository {
  findById(id: string): Promise<MarketplaceReviewDomainEntity | null>;

  findByOrder(coopname: string, order_id: string): Promise<MarketplaceReviewDomainEntity | null>;

  create(input: ReviewCreateInput): Promise<MarketplaceReviewDomainEntity>;

  updateContent(id: string, patch: { stars: number; text: string }): Promise<MarketplaceReviewDomainEntity>;

  /** Скрытие записывает, кто, когда и почему; открытие эти поля очищает. */
  setStatus(
    id: string,
    patch: { status: MarketplaceReviewStatus; hidden_by: string | null; hidden_at: Date | null; hidden_reason: string | null }
  ): Promise<MarketplaceReviewDomainEntity>;

  list(filter: ReviewListFilter, pagination: PaginationInputDTO): Promise<PaginationResult<MarketplaceReviewDomainEntity>>;

  /** Сводные оценки предложений одним запросом; предложений без отзывов в ответе нет. */
  ratingsByOffers(coopname: string, offer_ids: string[]): Promise<Map<string, MarketplaceReviewRating>>;

  /** Сводная оценка с распределением по звёздам — по опубликованным отзывам. */
  summary(coopname: string, target: ReviewSummaryTarget): Promise<MarketplaceReviewSummary>;
}
