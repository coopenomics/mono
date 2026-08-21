import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeDeclineContribution'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduDeclineContributionInput!') }, eduContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduDeclineContributionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
