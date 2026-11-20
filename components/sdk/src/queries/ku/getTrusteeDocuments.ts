import { kuTrusteeDocumentsSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuTrusteeDocuments'

/**
 * Доверенность и договор председателя кооперативного участка
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'KuTrusteeDocumentsInput!') }, kuTrusteeDocumentsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['KuTrusteeDocumentsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
