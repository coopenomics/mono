import { favoriteSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalFavorites'

/**
 * Список избранного пользователя (проекты, компоненты, задачи, артефакты)
 */
export const query = Selector('Query')({
  [name]: [{ filter: $('filter', 'CapitalFavoritesFilter!') }, favoriteSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter: ModelTypes['CapitalFavoritesFilter']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
