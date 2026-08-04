import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'
import { rawTimerSessionSelector } from './pauseTimer'

export const name = 'capitalResumeTimer'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalResumeTimerInput!') }, rawTimerSessionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalResumeTimerInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
