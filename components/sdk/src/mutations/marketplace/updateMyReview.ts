import { marketplaceReviewSelector } from '../../selectors/marketplace/reviewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceUpdateMyReview'

/** Автор правит свой отзыв: оценку и текст. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceUpdateMyReviewInput!') }, marketplaceReviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceUpdateMyReviewInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
