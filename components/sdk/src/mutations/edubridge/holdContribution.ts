import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeHoldContribution'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduHoldContributionInput!') }, eduContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduHoldContributionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
