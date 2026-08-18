import { favoriteSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalAddFavorite'

/**
 * Добавить сущность в личное избранное; возвращает обновлённый список
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalFavoriteInput!') }, favoriteSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalFavoriteInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
