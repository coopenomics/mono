import { providerAppSelector } from '../../selectors/system/providerAppSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'cancelProviderApp'

/** Отключить приложение каталога: подписка отменяется, приложение снимается с узла кооператива. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ProviderAppInput!') }, providerAppSelector],
})

export interface IInput {
  data: ModelTypes['ProviderAppInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
