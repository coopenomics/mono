import { catalogAppRightsSelector } from '../../selectors/extensions/catalogAppRightsSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'catalogAppRights'

/**
 * Права ядра приложения каталога на узле: что просит действующая версия, с чем
 * председатель согласился и какой запрос новых прав ждёт ответа.
 */
export const query = Selector('Query')({
  [name]: [{ packageId: $('packageId', 'String!') }, catalogAppRightsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  packageId: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
