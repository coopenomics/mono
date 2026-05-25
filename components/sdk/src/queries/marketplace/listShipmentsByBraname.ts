import { marketplaceShipmentSelector } from '../../selectors/marketplace/shipmentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListShipmentsByBraname'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceListShipmentsByBranameInput!') },
    marketplaceShipmentSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceListShipmentsByBranameInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
