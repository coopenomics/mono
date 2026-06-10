import { marketplaceEconomyConfigSelector } from '../../selectors/marketplace/economySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetMembershipFee'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetMembershipFeeInput!') }, marketplaceEconomyConfigSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetMembershipFeeInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
