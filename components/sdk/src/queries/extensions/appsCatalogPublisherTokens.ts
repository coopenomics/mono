import { publisherTokenSelector } from '../../selectors/extensions/publisherTokenSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'appsCatalogPublisherTokens'

/**
 * Publisher-токены издателей-пайщиков кооператива (487-27).
 * Стол разработчика, только chairman.
 */
export const query = Selector('Query')({
  [name]: publisherTokenSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
