import { marketplaceWriteoffProposalSelector } from '../../selectors/marketplace/writeoffSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceConfirmWriteoff'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceConfirmWriteoffInput!') },
    marketplaceWriteoffProposalSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceConfirmWriteoffInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
