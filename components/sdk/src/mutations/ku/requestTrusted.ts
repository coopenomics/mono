import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuRequestTrusted'

/**
 * Подать заявку на приём доверенным лицом кооперативного участка
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RequestKuTrustedInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RequestKuTrustedInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
