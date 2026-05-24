import { documentAggregateSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAplReceptionChairmanSignablePayloads'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceAplReceptionByIdInput!') },
    documentAggregateSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceAplReceptionByIdInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
