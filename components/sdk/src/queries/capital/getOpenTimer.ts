import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'
import { rawTimerSessionSelector } from '../../mutations/capital/pauseTimer'

export const name = 'capitalGetOpenTimer'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'CapitalGetOpenTimerInput!') }, rawTimerSessionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalGetOpenTimerInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
