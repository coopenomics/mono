import { marketplaceShipmentSelector } from '../../selectors/marketplace/shipmentSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetShipment'

export const query = Selector('Query')({
  [name]: [{ shipment_id: $('shipment_id', 'String!') }, marketplaceShipmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  shipment_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
