import { marketplaceReturnClaimResultSelector } from '../../selectors/marketplace/returnClaimSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceApproveReturnVisit'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceApproveReturnVisitInput!') },
    marketplaceReturnClaimResultSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceApproveReturnVisitInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
