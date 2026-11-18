import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuSignTrusteeLiability'

/**
 * Подписать договор о полной материальной ответственности председателя участка — на встречную подпись председателю совета
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SignKuTrusteeLiabilityInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SignKuTrusteeLiabilityInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
