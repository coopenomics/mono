import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuJoinDecision'

/**
 * Присоединиться к собранию пайщиков кооперативного участка
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'JoinKuDecisionInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['JoinKuDecisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
