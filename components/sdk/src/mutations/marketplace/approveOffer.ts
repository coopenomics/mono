import { marketplaceOfferSelector } from '../../selectors/marketplace/offerSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceApproveOffer'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceApproveOfferInput!') }, marketplaceOfferSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceApproveOfferInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
