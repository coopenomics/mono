import { marketplaceReviewPaginationSelector } from '../../selectors/marketplace/reviewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListReviews'

/** Отзывы о предложении, обо всех предложениях поставщика либо одного автора. */
export const query = Selector('Query')({
  [name]: [
    {
      filter: $('filter', 'MarketplaceListReviewsFilterInput'),
      options: $('options', 'PaginationInput'),
    },
    marketplaceReviewPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['MarketplaceListReviewsFilterInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
