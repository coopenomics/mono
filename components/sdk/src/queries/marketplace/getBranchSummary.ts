import { marketplaceBranchSummarySelector } from '../../selectors/marketplace/branchSummarySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetBranchSummary'

/** Сводка кооперативного участка для пайщика: пункт выдачи, кошельки участка, взносы инициаторов. */
export const query = Selector('Query')({
  [name]: [{ braname: $('braname', 'String!') }, marketplaceBranchSummarySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
