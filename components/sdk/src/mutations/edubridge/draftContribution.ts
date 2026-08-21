import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeDraftContribution'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduContributionDraftInput!') }, eduContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduContributionDraftInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
