import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeReworkContribution'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduReworkContributionInput!') }, eduContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduReworkContributionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
