import { marketplaceBranchInvestmentSelector } from '../../selectors/marketplace/investSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceDeclineInvestProperty'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceDeclineInvestPropertyInput!') }, marketplaceBranchInvestmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceDeclineInvestPropertyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
