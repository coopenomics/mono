import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const rawTimerSessionSelector = {
  _id: true,
  contributor_hash: true,
  issue_hash: true,
  project_hash: true,
  coopname: true,
  started_at: true,
  stopped_at: true,
  paused_at: true,
  total_paused_ms: true,
  is_paused: true,
  elapsed_seconds: true,
  issue_title: true,
}

export const name = 'capitalPauseTimer'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalPauseTimerInput!') }, rawTimerSessionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalPauseTimerInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
