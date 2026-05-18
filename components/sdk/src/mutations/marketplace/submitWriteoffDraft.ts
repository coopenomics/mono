import { marketplaceWriteoffProposalSelector } from '../../selectors/marketplace/writeoffSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSubmitWriteoffDraft'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceSubmitWriteoffDraftInput!') },
    marketplaceWriteoffProposalSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceSubmitWriteoffDraftInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
