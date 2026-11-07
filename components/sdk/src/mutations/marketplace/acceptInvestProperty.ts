import { marketplaceBranchInvestmentSelector } from '../../selectors/marketplace/investSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAcceptInvestProperty'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSignInvestPropertyInput!') }, marketplaceBranchInvestmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSignInvestPropertyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
