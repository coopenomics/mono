import { marketplaceBranchWalletHistoryPaginationSelector } from '../../selectors/marketplace/economySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceGetBranchWalletHistory'

export const query = Selector('Query')({
  [name]: [
    { braname: $('braname', 'String!'), options: $('options', 'PaginationInput') },
    marketplaceBranchWalletHistoryPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
