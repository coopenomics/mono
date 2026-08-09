import { marketplaceWriteoffProposalSelector } from '../../selectors/marketplace/writeoffSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceUpdateWriteoffDraft'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceUpdateWriteoffDraftInput!') },
    marketplaceWriteoffProposalSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceUpdateWriteoffDraftInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
