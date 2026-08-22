import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'declineDecision'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DeclineDecisionInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DeclineDecisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
