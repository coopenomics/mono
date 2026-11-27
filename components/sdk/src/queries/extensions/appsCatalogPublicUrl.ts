import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'appsCatalogPublicUrl'

/**
 * Адрес каталога приложений для команд набора издателя на компьютере
 * разработчика (487-37). `null` — адрес узлу не задан.
 */
export const query = Selector('Query')({
  [name]: true,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
