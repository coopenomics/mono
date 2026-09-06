import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceIssuanceActPayload'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceIssuanceOrderInput!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceIssuanceOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
