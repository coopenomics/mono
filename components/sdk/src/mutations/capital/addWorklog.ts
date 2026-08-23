import { rawTimeEntrySelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalAddWorklog'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalAddWorklogInput!') }, rawTimeEntrySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalAddWorklogInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
