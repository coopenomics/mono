import { marketplaceOfferSelector } from '../../selectors/marketplace/offerSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRejectOffer'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceRejectOfferInput!') }, marketplaceOfferSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceRejectOfferInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
