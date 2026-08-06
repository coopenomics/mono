import { marketplaceBranchWalletHistoryPaginationSelector } from '../../selectors/marketplace/economySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceGetPersonalWalletHistory'

export const query = Selector('Query')({
  [name]: [{ options: $('options', 'PaginationInput') }, marketplaceBranchWalletHistoryPaginationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
