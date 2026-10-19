import { cooperativeRegistryItemSelector } from '../../selectors/system/cooperativeRegistryItemSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getCooperativesRegistry'

/**
 * Реестр кооперативов оператора: список кооперативов из блокчейна,
 * обогащённый данными провайдера (подписки / инстанс / биллинг).
 */
export const query = Selector('Query')({
  [name]: cooperativeRegistryItemSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
