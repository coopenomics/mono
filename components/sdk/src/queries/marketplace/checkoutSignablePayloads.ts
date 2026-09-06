import { marketplaceCheckoutPreviewSelector } from '../../selectors/marketplace/cartSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceCheckoutSignablePayloads'

export const query = Selector('Query')({
  [name]: marketplaceCheckoutPreviewSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
