import { revokedSessionsResultSelector } from '../../selectors/accountSecurity/revokedSessionsResultSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'reportNotMe'

/**
 * Сигнал «Это не я»: немедленно завершить все сессии пайщика.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ReportNotMeInput!') }, revokedSessionsResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ReportNotMeInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
