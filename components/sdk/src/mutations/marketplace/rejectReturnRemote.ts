import { marketplaceReturnClaimResultSelector } from '../../selectors/marketplace/returnClaimSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRejectReturnRemote'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceRejectReturnRemoteInput!') },
    marketplaceReturnClaimResultSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceRejectReturnRemoteInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
