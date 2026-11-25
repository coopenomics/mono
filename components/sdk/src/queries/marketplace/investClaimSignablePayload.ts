import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceInvestClaimSignablePayload'

export const query = Selector('Query')({
  [name]: [{ braname: $('braname', 'String!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
