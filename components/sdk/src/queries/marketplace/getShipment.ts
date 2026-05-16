import { marketplaceShipmentSelector } from '../../selectors/marketplace/shipmentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceGetShipment'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceGetShipmentInput!') }, marketplaceShipmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceGetShipmentInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
