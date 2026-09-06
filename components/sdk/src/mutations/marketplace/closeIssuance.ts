import { marketplaceIssuanceSagaSelector } from '../../selectors/marketplace/issuanceSagaSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCloseIssuance'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSignIssuanceActInput!') }, marketplaceIssuanceSagaSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSignIssuanceActInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
