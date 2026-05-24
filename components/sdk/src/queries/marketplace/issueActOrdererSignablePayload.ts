import { documentAggregateSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceIssueActOrdererSignablePayload'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceIssueActPayloadInput!') },
    documentAggregateSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceIssueActPayloadInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
