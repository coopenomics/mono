import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuCreateDecision'

/**
 * Объявить собрание пайщиков кооперативного участка
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateKuDecisionInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateKuDecisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
