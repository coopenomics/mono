import { marketplaceBranchPeriodsPaginationSelector } from '../../selectors/marketplace/keuSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListBranchPeriods'

export const query = Selector('Query')({
  [name]: [{ braname: $('braname', 'String!'), options: $('options', 'PaginationInput') }, marketplaceBranchPeriodsPaginationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
  options?: ModelTypes['PaginationInput'] | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
