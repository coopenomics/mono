import { marketplaceOfferSelector } from '../../selectors/marketplace/offerSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplacePublishStock'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplacePublishStockInput!') }, marketplaceOfferSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplacePublishStockInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
