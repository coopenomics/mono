import { rawContentRevisionSummarySelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalRestoreContentRevision'

/**
 * Откат к редакции: её содержимое записывается как новая редакция (origin=RESTORE)
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalRestoreContentRevisionInput!') }, rawContentRevisionSummarySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalRestoreContentRevisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
