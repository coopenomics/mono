import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalDeclineProgramExpense'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DeclineProgramExpenseInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DeclineProgramExpenseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
