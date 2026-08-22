import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceReturnClaimSignablePayload'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceReturnClaimSignablePayloadInput!') },
    documentSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceReturnClaimSignablePayloadInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
