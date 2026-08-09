import { marketplaceReturnClaimResultSelector } from '../../selectors/marketplace/returnClaimSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAcceptReturnAtVisit'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceAcceptReturnAtVisitInput!') },
    marketplaceReturnClaimResultSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceAcceptReturnAtVisitInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
