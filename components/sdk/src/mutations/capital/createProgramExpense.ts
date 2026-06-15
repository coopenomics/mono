import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalCreateProgramExpense'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalCreateProgramExpenseInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalCreateProgramExpenseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
