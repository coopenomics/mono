import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'setCatalogAppEnabled'

/** Включить или выключить приложение каталога на рабочем столе; подписка не меняется. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SetCatalogAppEnabledInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetCatalogAppEnabledInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
