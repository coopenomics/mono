import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuVoteOnDecision'

/**
 * Подать бюллетень на собрании пайщиков участка
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'VoteOnKuDecisionInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['VoteOnKuDecisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
