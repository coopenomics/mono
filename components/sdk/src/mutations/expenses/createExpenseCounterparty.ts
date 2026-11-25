import { expenseCounterpartySelector } from '../../selectors/expenses/expenseCounterpartySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Добавить контрагента. */
export const name = 'createExpenseCounterparty'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SaveExpenseCounterpartyInput!') }, expenseCounterpartySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SaveExpenseCounterpartyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
