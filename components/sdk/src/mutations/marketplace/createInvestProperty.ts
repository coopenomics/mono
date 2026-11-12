import { marketplaceBranchInvestmentSelector } from '../../selectors/marketplace/investSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateInvestProperty'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceCreateInvestPropertyInput!') }, marketplaceBranchInvestmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCreateInvestPropertyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
