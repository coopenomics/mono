import { documentAggregateSelector } from '../../selectors/documents'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeActSignablePayload'

export const query = Selector('Query')({
  [name]: [{ contribution_id: $('contribution_id', 'ID!') }, documentAggregateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  contribution_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
