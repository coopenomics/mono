import { marketplaceInvestorSelector } from '../../selectors/marketplace/investSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceClaimInvestment'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceClaimInvestmentInput!') }, marketplaceInvestorSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceClaimInvestmentInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
