import { eduEconomySettingsSelector } from '../../selectors/edubridge/economySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSetEconomySettings'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSetEconomySettingsInput!') }, eduEconomySettingsSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSetEconomySettingsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
