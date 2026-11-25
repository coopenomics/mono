import { marketplaceBranchInvestmentSelector } from '../../selectors/marketplace/investSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceBranchInvestment'

export const query = Selector('Query')({
  [name]: [{ braname: $('braname', 'String!') }, marketplaceBranchInvestmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
