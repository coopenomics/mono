import { marketplaceOrderSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceReadyIssue'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceReadyIssueInput!') }, marketplaceOrderSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceReadyIssueInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
