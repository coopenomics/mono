import { marketplaceWriteoffCandidateSelector } from '../../selectors/marketplace/writeoffSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListWriteoffCandidates'

export const query = Selector('Query')({
  [name]: marketplaceWriteoffCandidateSelector,
})

export interface IInput {
  /** @private */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
