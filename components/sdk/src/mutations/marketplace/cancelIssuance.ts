import { marketplaceIssuanceSagaSelector } from '../../selectors/marketplace/issuanceSagaSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCancelIssuance'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceIssuanceOrderInput!') }, marketplaceIssuanceSagaSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceIssuanceOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
