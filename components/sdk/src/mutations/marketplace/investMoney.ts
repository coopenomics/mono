import { marketplaceBranchInvestmentSelector } from '../../selectors/marketplace/investSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceInvestMoney'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceInvestMoneyInput!') }, marketplaceBranchInvestmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceInvestMoneyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
