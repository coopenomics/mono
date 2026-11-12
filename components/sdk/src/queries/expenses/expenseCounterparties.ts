import { expenseCounterpartySelector } from '../../selectors/expenses/expenseCounterpartySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Контрагенты кооператива с поиском. */
export const name = 'expenseCounterparties'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'ListExpenseCounterpartiesInput') }, expenseCounterpartySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data?: ModelTypes['ListExpenseCounterpartiesInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
