import { marketplaceOfferSelector } from '../../selectors/marketplace/offerSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateOffer'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceCreateOfferInput!') }, marketplaceOfferSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceCreateOfferInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
