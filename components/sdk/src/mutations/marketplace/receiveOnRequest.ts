import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'receiveOnRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ReceiveOnRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ReceiveOnRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
