import { marketplaceReturnClaimSelector } from '../../selectors/marketplace/returnClaimSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceReturnClaim'

export const query = Selector('Query')({
  [name]: [{ claim_id: $('claim_id', 'String!') }, marketplaceReturnClaimSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  claim_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
