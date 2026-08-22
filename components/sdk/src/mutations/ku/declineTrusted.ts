import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuDeclineTrusted'

/**
 * Отклонить заявку доверенного лица
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DeclineKuTrustedInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DeclineKuTrustedInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
