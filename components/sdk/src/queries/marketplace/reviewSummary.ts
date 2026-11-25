import { marketplaceReviewSummarySelector } from '../../selectors/marketplace/reviewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceReviewSummary'

/** Сводная оценка по отзывам о предложении либо обо всех предложениях поставщика. */
export const query = Selector('Query')({
  [name]: [{ filter: $('filter', 'MarketplaceReviewSummaryInput!') }, marketplaceReviewSummarySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter: ModelTypes['MarketplaceReviewSummaryInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
