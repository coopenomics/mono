import { marketplaceBranchEconomySelector } from '../../selectors/marketplace/economySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetBranchEconomy'

export const query = Selector('Query')({
  [name]: [{ braname: $('braname', 'String!') }, marketplaceBranchEconomySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
