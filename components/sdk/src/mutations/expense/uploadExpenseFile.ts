import { rawExpenseFileSelector } from '../../selectors/expense'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'uploadExpenseFile'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UploadExpenseFileInput!') }, rawExpenseFileSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['UploadExpenseFileInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
