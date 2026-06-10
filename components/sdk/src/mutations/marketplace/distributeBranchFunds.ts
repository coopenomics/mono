import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceDistributeBranchFunds'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceDistributeBranchFundsInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceDistributeBranchFundsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
