import { robotDecisionsPaginationSelector } from '../../selectors/sovietRobot'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'sovietRobotJournal'

/**
 * Журнал решений робота: этапы, голоса, транзакции и ошибки
 */
export const query = Selector('Query')({
  [name]: [{ options: $('options', 'PaginationInput') }, robotDecisionsPaginationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
