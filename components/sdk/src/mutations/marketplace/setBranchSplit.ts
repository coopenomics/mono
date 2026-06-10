import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetBranchSplit'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetBranchSplitInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetBranchSplitInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
