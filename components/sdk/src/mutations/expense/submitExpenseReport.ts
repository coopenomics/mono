import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'submitExpenseReport'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SubmitExpenseReportInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SubmitExpenseReportInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
