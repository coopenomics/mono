import { documentAggregateSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceWriteoffProtocolDocument'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceWriteoffProtocolDocumentInput!') },
    documentAggregateSelector,
  ],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  data: ModelTypes['MarketplaceWriteoffProtocolDocumentInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
