import { marketplaceContainerTypeSelector } from '../../selectors/marketplace/storageSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListContainerTypes'

export const query = Selector('Query')({
  [name]: [{ is_active: $('is_active', 'Boolean') }, marketplaceContainerTypeSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  /** Только типы в обороте. Не указано — вместе с выведенными. */
  is_active?: boolean
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
