import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Удалить контрагента. */
export const name = 'deleteExpenseCounterparty'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ExpenseCounterpartyIdInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ExpenseCounterpartyIdInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
