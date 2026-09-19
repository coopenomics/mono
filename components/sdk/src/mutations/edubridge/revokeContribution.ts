import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeRevokeContribution'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduRevokeContributionInput!') }, eduContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduRevokeContributionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
