import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'
import { rawTimerSessionSelector } from './pauseTimer'

export const name = 'capitalStartTimer'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalStartTimerInput!') }, rawTimerSessionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalStartTimerInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
