import { type branchModel, branchSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'setBranchPrivate'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SetBranchPrivateInput!') }, branchSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetBranchPrivateInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
