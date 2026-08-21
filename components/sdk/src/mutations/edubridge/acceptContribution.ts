import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeAcceptContribution'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduAcceptContributionInput!') }, eduContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduAcceptContributionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
