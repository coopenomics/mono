import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCloseContribution'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduCloseContributionInput!') }, eduContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduCloseContributionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
