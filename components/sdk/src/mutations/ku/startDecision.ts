import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuStartDecision'

/**
 * Открыть голосование на собрании пайщиков участка
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'StartKuDecisionInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['StartKuDecisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
