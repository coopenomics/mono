import { type branchModel, branchSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'deleteBranchWhitelist'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DeleteBranchWhitelistInput!') }, branchSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DeleteBranchWhitelistInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
