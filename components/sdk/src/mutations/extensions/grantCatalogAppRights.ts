import { catalogAppRightsSelector } from '../../selectors/extensions/catalogAppRightsSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'grantCatalogAppRights'

/** Согласие председателя на права ядра приложения: без него ядро не выдаёт приложению ключ. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'GrantCatalogAppRightsInput!') }, catalogAppRightsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GrantCatalogAppRightsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
