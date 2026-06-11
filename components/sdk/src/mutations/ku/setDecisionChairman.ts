import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuSetDecisionChairman'

/**
 * Назначить председателя собрания из числа участников
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SetKuDecisionChairmanInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetKuDecisionChairmanInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
