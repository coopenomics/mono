import { rawContentRevisionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalGetContentRevision'

/**
 * Одна редакция содержимого с телом
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'CapitalGetContentRevisionInput!') }, rawContentRevisionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalGetContentRevisionInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
