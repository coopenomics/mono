import { marketplaceReviewSelector } from '../../selectors/marketplace/reviewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetReviewStatus'

/** Администратор скрывает отзыв с причиной либо возвращает его в публикацию. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetReviewStatusInput!') }, marketplaceReviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetReviewStatusInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
