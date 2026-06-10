import { expensePlanSelector } from '../../selectors/expenses/expensePlanSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'listExpensePlans'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'ListExpensePlansInput') }, expensePlanSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data?: ModelTypes['ListExpensePlansInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
