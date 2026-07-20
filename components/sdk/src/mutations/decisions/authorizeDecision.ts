import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'authorizeDecision'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'AuthorizeDecisionInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['AuthorizeDecisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
