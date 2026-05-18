import { marketplaceReturnClaimSelector } from '../../selectors/marketplace/returnClaimSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListMyReturnClaims'

export const query = Selector('Query')({
  [name]: marketplaceReturnClaimSelector,
})

export interface IInput {
  /** @private */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
