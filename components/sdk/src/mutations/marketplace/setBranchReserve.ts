import { marketplaceBranchReservesSelector } from '../../selectors/marketplace/keuSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetBranchReserve'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetBranchReserveInput!') }, marketplaceBranchReservesSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetBranchReserveInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
