import { marketplaceWriteoffProposalSelector } from '../../selectors/marketplace/writeoffSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceWriteoffProposal'

export const query = Selector('Query')({
  [name]: [{ id: $('id', 'String!') }, marketplaceWriteoffProposalSelector],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
