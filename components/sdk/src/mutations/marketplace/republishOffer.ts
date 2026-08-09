import { marketplaceOfferSelector } from '../../selectors/marketplace/offerSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRepublishOffer'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceRepublishOfferInput!') }, marketplaceOfferSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceRepublishOfferInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
