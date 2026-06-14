import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceWriteoffProtocolDocument'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceWriteoffProtocolDocumentInput!') },
    documentSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceWriteoffProtocolDocumentInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
