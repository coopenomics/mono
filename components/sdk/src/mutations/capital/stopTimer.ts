import { rawTimeEntrySelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalStopTimer'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalStopTimerInput!') }, rawTimeEntrySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalStopTimerInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
