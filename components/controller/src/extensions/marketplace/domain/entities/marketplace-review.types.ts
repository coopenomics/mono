/**
 * Отзыв заказчика о полученном имуществе (задача 598-61).
 *
 * PUBLISHED — виден всем пайщикам на карточке предложения и в профиле
 * поставщика; HIDDEN — скрыт администратором: его видят автор и администратор,
 * в списках и сводных оценках его нет.
 */
export type MarketplaceReviewStatus = 'PUBLISHED' | 'HIDDEN';

export const MarketplaceReviewStatuses = {
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
} as const satisfies Record<string, MarketplaceReviewStatus>;

export const MARKETPLACE_REVIEW_STARS_MIN = 1;
export const MARKETPLACE_REVIEW_STARS_MAX = 5;
export const MARKETPLACE_REVIEW_TEXT_MAX = 4000;
export const MARKETPLACE_REVIEW_HIDDEN_REASON_MAX = 1000;

/** Сводная оценка по опубликованным отзывам: средняя и число отзывов. */
export interface MarketplaceReviewRating {
  /** Средняя оценка, округлённая до десятых; null — отзывов нет. */
  rating_avg: number | null;
  reviews_count: number;
}

/** Сводная оценка с распределением по звёздам — для полосы распределения. */
export interface MarketplaceReviewSummary extends MarketplaceReviewRating {
  /** Пять строк, от пяти звёзд к одной; число отзывов с такой оценкой. */
  stars_breakdown: Array<{ stars: number; count: number }>;
}

export const MARKETPLACE_REVIEW_NO_RATING: MarketplaceReviewRating = { rating_avg: null, reviews_count: 0 };
