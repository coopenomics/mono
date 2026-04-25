import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'confirmReceiveOnRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ConfirmReceiveOnRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ConfirmReceiveOnRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
