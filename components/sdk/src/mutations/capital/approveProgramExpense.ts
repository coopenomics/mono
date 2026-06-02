import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalApproveProgramExpense'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ApproveProgramExpenseInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ApproveProgramExpenseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
