import { publisherTokenSelector } from '../../selectors/extensions/publisherTokenSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'myPublisherTokens'

/**
 *  Мои ключи каталога, без секретов (487-27).

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
