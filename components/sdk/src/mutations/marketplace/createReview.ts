import { marketplaceReviewSelector } from '../../selectors/marketplace/reviewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateReview'

/** Заказчик оставляет отзыв по полученному заказу. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceCreateReviewInput!') }, marketplaceReviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCreateReviewInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
