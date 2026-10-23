import { shareTransfersPaginationSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalShareTransfers'

/**
 * История трансляций паевого взноса из Благороста в Цифровой Кошелёк
 */
export const query = Selector('Query')({
  [name]: [{ filter: $('filter', 'CapitalShareTransferFilter'), options: $('options', 'PaginationInput') }, shareTransfersPaginationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['CapitalShareTransferFilter']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
