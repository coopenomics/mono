import { appsCatalogRemotePackageSelector } from '../../selectors/extensions/appsCatalogRemotePackageSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'appsCatalogRemotePackages'

/**
 * Публичный каталог remote-пакетов из apps-catalog (Story 9.5.b).
 *
 * Прокси-резолвер на mono controller'е дергает ca-admin
 * `GET /v1/public/packages` и возвращает список с UI-полями
 * (title / description / rubPerMonth — на MVP из дефолтов, в будущем из manifest).
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
