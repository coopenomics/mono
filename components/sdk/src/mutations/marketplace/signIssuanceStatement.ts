import { marketplaceIssuanceSagaSelector } from '../../selectors/marketplace/issuanceSagaSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSignIssuanceStatement'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSignIssuanceStatementInput!') }, marketplaceIssuanceSagaSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSignIssuanceStatementInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
