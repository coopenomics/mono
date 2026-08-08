import { type branchModel, branchSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'addBranchWhitelist'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'AddBranchWhitelistInput!') }, branchSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['AddBranchWhitelistInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
