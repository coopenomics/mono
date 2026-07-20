import { expenseFileSelector } from '../../selectors/expense'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'expenseFile'

export const query = Selector('Query')({
  [name]: [{ id: $('id', 'Int!') }, expenseFileSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: number
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
