import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAidStatementSignablePayload'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceAidStatementSignablePayloadInput!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceAidStatementSignablePayloadInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
