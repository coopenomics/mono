import { marketplaceShipmentSelector } from '../../selectors/marketplace/shipmentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListShipments'

export const query = Selector('Query')({
  [name]: [{ input: $('input', 'MarketplaceListShipmentsInput') }, marketplaceShipmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input?: ModelTypes['MarketplaceListShipmentsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
