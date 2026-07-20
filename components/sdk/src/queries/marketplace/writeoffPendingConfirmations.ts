import { marketplaceWriteoffConfirmationGroupSelector } from '../../selectors/marketplace/writeoffSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceWriteoffPendingConfirmations'

export const query = Selector('Query')({
  [name]: marketplaceWriteoffConfirmationGroupSelector,
})

export interface IInput {
  /** @private */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
