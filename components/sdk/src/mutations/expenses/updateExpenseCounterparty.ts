import { expenseCounterpartySelector } from '../../selectors/expenses/expenseCounterpartySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Изменить контрагента. */
export const name = 'updateExpenseCounterparty'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UpdateExpenseCounterpartyInput!') }, expenseCounterpartySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['UpdateExpenseCounterpartyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
