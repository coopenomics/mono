import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceIssueActChairmanSignablePayload'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceIssueActPayloadInput!') },
    documentSelector,
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
