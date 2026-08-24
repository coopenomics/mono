import { rawCooperativeCharterSelector } from '../../selectors/system/cooperativeCharterSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getCooperativeCharter'

/**
 * Последний устав кооператива вместе со свежей короткоживущей ссылкой на
 * скачивание. Читает и сам кооператив (проверить, что файл дошёл), и совет.
 */
export const query = Selector('Query')({
  [name]: [
    { coopname: $('coopname', 'String!'), username: $('username', 'String!') },
    rawCooperativeCharterSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  username: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
