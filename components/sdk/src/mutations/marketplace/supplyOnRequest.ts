import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'supplyOnRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SupplyOnRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SupplyOnRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
