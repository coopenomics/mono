import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'createExpenseProposal'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateExpenseProposalInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateExpenseProposalInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
