import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceWriteoffStatementSignablePayload'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceWriteoffStatementSignablePayloadInput!') },
    documentSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceWriteoffStatementSignablePayloadInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
