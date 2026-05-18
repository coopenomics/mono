import { marketplaceReturnClaimResultSelector } from '../../selectors/marketplace/returnClaimSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateReturnClaim'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceCreateReturnClaimInput!') },
    marketplaceReturnClaimResultSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceCreateReturnClaimInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
