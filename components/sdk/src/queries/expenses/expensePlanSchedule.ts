import { expensePlanScheduleSelector } from '../../selectors/expenses/expensePlanSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Показ планового расхода до добавления: сроки платежей и резерв в месяц. */
export const name = 'expensePlanSchedule'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'ExpensePlanScheduleInput!') }, expensePlanScheduleSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ExpensePlanScheduleInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
