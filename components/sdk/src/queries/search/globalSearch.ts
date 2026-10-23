import { globalSearchGroupSelector } from '../../selectors/search'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'globalSearch'

/**
 * Единый поиск окна столов и страниц: пайщики, документы и записи приложений,
 * сгруппированные по источнику. Права проверяет каждый источник сам.
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GlobalSearchInput!') }, globalSearchGroupSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GlobalSearchInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
