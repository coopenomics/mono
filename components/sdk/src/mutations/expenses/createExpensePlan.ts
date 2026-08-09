import { expensePlanSelector } from '../../selectors/expenses/expensePlanSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'createExpensePlan'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateExpensePlanInput!') }, expensePlanSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateExpensePlanInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
