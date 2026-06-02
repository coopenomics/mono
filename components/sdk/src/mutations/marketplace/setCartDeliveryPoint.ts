import { marketplaceCartSelector } from '../../selectors/marketplace/cartSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetCartDeliveryPoint'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceSetCartDeliveryPointInput!') }, marketplaceCartSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceSetCartDeliveryPointInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
