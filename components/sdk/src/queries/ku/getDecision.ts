import { kuDecisionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'kuDecision'

/**
 * Получить решение собрания участка по хэшу (с вопросами повестки)
 */
export const query = Selector('Query')({
  [name]: [{ hash: $('hash', 'String!') }, kuDecisionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  hash: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
