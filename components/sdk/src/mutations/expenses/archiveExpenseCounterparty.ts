import { expenseCounterpartySelector } from '../../selectors/expenses/expenseCounterpartySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Убрать контрагента в архив или вернуть. */
export const name = 'archiveExpenseCounterparty'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ArchiveExpenseCounterpartyInput!') }, expenseCounterpartySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ArchiveExpenseCounterpartyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
