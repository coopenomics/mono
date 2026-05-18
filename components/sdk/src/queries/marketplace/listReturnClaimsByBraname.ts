import { marketplaceReturnClaimSelector } from '../../selectors/marketplace/returnClaimSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListReturnClaimsByBraname'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceListReturnClaimsByBranameInput!') },
    marketplaceReturnClaimSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceListReturnClaimsByBranameInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
