import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'overspendExpenseItem'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'OverspendExpenseItemInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['OverspendExpenseItemInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
