import { rawProviderConnectionCatalogSelector } from '../../selectors/system/providerConnectionCatalogSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getProviderConnectionCatalog'

/**
 * Каталог витрины подключения (Epic 28): услуги и конфигурации сервера с
 * живыми ценами провайдера. С coopname услуги фильтруются листом зависимостей.
 */
export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String') }, rawProviderConnectionCatalogSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname?: string | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
