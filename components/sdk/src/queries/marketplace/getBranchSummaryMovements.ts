import { marketplaceBranchSummaryMovementsPaginationSelector } from '../../selectors/marketplace/branchSummarySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceGetBranchSummaryMovements'

/** Движения по общему кошельку участка для пайщика: дата, операция и сумма. */
export const query = Selector('Query')({
  [name]: [
    { braname: $('braname', 'String!'), options: $('options', 'PaginationInput') },
    marketplaceBranchSummaryMovementsPaginationSelector,
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
