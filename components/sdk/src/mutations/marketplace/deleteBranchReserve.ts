import { marketplaceBranchReservesSelector } from '../../selectors/marketplace/keuSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceDeleteBranchReserve'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceDeleteBranchReserveInput!') }, marketplaceBranchReservesSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceDeleteBranchReserveInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
