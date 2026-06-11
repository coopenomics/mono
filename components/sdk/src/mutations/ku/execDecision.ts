import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuExecDecision'

/**
 * Направить заявление председателя собрания в совет об учреждении участка
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ExecKuDecisionInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ExecKuDecisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
