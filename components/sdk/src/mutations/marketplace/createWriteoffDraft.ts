import { marketplaceWriteoffProposalSelector } from '../../selectors/marketplace/writeoffSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateWriteoffDraft'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceCreateWriteoffDraftInput!') },
    marketplaceWriteoffProposalSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceCreateWriteoffDraftInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
