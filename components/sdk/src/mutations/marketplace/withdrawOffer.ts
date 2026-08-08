import { marketplaceOfferSelector } from '../../selectors/marketplace/offerSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceWithdrawOffer'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceWithdrawOfferInput!') }, marketplaceOfferSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceWithdrawOfferInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
