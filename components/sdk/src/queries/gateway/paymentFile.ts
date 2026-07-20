import { paymentFileSelector } from '../../selectors/gateway/paymentFileSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'paymentFile'

export const query = Selector('Query')({
  [name]: [{ id: $('id', 'Int!') }, paymentFileSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: number
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
