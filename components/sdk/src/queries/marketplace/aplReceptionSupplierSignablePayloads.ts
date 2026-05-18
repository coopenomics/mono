import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAplReceptionSupplierSignablePayloads'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceAplReceptionByIdInput!') },
    documentSelector,
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
