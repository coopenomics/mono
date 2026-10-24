import { providerAppSelector } from '../../selectors/system/providerAppSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getProviderApps'

/** Приложения каталога, которые кооператив может подключить, и его подписки на них. */
export const query = Selector('Query')({
  [name]: providerAppSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
