import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuApproveTrusted'

/**
 * Одобрить заявку доверенного встречной подписью председателя участка
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ApproveKuTrustedInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ApproveKuTrustedInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
