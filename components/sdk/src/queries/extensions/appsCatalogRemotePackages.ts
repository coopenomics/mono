import { appsCatalogRemotePackageSelector } from '../../selectors/extensions/appsCatalogRemotePackageSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'appsCatalogRemotePackages'

/**
 * Приложения каталога для узла: цена и пробный срок у провайдера подключения,
 * подписка кооператива, получен ли фронт и включено ли приложение.
 */
export const query = Selector('Query')({
  [name]: [
    { page: $('page', 'Float!'), pageSize: $('pageSize', 'Float!') },
    appsCatalogRemotePackageSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  page: number
  pageSize: number
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
