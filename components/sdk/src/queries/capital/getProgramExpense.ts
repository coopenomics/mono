import { programExpenseSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalProgramExpense'

/**
 * Расход программы «Благорост» по внутреннему ID базы данных.
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetProgramExpenseInput!') }, programExpenseSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetProgramExpenseInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
