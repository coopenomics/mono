import { marketplaceCreateShipmentResultSelector } from '../../selectors/marketplace/shipmentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateShipment'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceCreateShipmentInput!') }, marketplaceCreateShipmentResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCreateShipmentInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
