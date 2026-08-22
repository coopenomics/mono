import { marketplaceCancelOrderResultSelector } from '../../selectors/marketplace/orderSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCancelOrder'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'MarketplaceCancelOrderInput!') }, marketplaceCancelOrderResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceCancelOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
