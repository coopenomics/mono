import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'confirmSupplyOnRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ConfirmSupplyOnRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ConfirmSupplyOnRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
