import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceConvertBranchFunds'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceConvertBranchFundsInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceConvertBranchFundsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
