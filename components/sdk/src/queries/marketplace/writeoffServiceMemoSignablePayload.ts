import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceWriteoffServiceMemoSignablePayload'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceWriteoffServiceMemoSignablePayloadInput!') },
    documentSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceWriteoffServiceMemoSignablePayloadInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
