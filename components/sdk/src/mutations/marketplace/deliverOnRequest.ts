import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'deliverOnRequest'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DeliverOnRequestInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DeliverOnRequestInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
