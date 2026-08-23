import { marketplaceReturnClaimResultSelector } from '../../selectors/marketplace/returnClaimSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRejectReturnAtVisit'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceRejectReturnAtVisitInput!') },
    marketplaceReturnClaimResultSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceRejectReturnAtVisitInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
