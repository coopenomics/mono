import { documentAggregateSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceReturnClaimChairmanSignablePayload'

export const query = Selector('Query')({
  [name]: [{ claim_id: $('claim_id', 'String!') }, documentAggregateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  claim_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
