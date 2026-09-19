import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCreateExpense'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduCreateExpenseInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduCreateExpenseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
