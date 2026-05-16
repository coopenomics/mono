import { marketplaceAplReceptionSignablePayloadSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceAplReceptionChairmanSignablePayloads'

export const query = Selector('Query')({
  [name]: [
    { apl_reception_id: $('apl_reception_id', 'String!') },
    marketplaceAplReceptionSignablePayloadSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  apl_reception_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
