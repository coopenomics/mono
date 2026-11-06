import { programPropertiesPaginationSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalProgramProperties'

/**
 * Паевые взносы имуществом в программу «Благорост»: свои — пайщику, все — совету
 */
export const query = Selector('Query')({
  [name]: [{ filter: $('filter', 'CapitalProgramPropertyFilter'), options: $('options', 'PaginationInput') }, programPropertiesPaginationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['CapitalProgramPropertyFilter']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
