import { expenseCounterpartyFormSelector } from '../../selectors/expenses/expenseCounterpartySelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

/** Форма контрагента по стране кооператива. */
export const name = 'expenseCounterpartyForm'

export const query = Selector('Query')({
  [name]: expenseCounterpartyFormSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
