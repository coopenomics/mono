import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSubmitContribution'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSubmitContributionInput!') }, eduContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSubmitContributionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
