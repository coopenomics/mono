import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'prohibitRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ProhibitRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ProhibitRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
