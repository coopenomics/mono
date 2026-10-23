import { eduExpensesPaginationResultSelector } from '../../selectors/edubridge/expenseSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeExpenses'

export const query = Selector('Query')({
  [name]: [{ options: $('options', 'PaginationInput') }, eduExpensesPaginationResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
