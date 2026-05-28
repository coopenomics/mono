import { marketplaceOfferSelector } from '../../selectors/marketplace/offerSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceUpdateOffer'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceUpdateOfferInput!') }, marketplaceOfferSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceUpdateOfferInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
