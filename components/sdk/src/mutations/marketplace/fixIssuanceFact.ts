import { marketplaceIssuanceStatementPayloadSelector } from '../../selectors/marketplace/issuanceSagaSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceFixIssuanceFact'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceFixIssuanceFactInput!') }, marketplaceIssuanceStatementPayloadSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceFixIssuanceFactInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
