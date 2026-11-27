import { catalogAppRightsSelector } from '../../selectors/extensions/catalogAppRightsSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'setCatalogAppRightsAutoAccept'

/** Переключатель «Принимать новые права после одобрения модератора каталога». */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SetCatalogAppRightsAutoAcceptInput!') }, catalogAppRightsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetCatalogAppRightsAutoAcceptInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
