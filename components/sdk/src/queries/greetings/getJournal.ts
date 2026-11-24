import { greetingSendsPaginationSelector } from '../../selectors/greetings'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'greetingsJournal'

export const query = Selector('Query')({
  [name]: [{ options: $('options', 'PaginationInput') }, greetingSendsPaginationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
