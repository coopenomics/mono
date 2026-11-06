import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

/** Отзыв заказчика о полученном имуществе. */
const rawReviewSelector = {
  id: true,
  order_id: true,
  offer_id: true,
  offer_name: true,
  supplier_account: true,
  author_account: true,
  author_name: true,
  stars: true,
  text: true,
  status: true,
  hidden_reason: true,
  created_at: true,
  updated_at: true,
}

const _validateReview: MakeAllFieldsRequired<ValueTypes['MarketplaceReview']> = rawReviewSelector

export const marketplaceReviewSelector = Selector('MarketplaceReview')(rawReviewSelector)

const rawReviewPaginationSelector = {
  items: marketplaceReviewSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
}

const _validateReviewPagination: MakeAllFieldsRequired<ValueTypes['MarketplaceReviewPaginationResult']> =
  rawReviewPaginationSelector

export const marketplaceReviewPaginationSelector = Selector('MarketplaceReviewPaginationResult')(
  rawReviewPaginationSelector,
)

/** Сводная оценка: средняя, число отзывов и распределение по оценкам. */
const rawReviewSummarySelector = {
  rating_avg: true,
  reviews_count: true,
  stars_breakdown: {
    stars: true,
    count: true,
  },
}

const _validateReviewSummary: MakeAllFieldsRequired<ValueTypes['MarketplaceReviewSummary']> =
  rawReviewSummarySelector

export const marketplaceReviewSummarySelector = Selector('MarketplaceReviewSummary')(rawReviewSummarySelector)
