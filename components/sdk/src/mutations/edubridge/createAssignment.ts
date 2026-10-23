import { eduAssignmentSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCreateAssignment'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduAssignmentInput!') }, eduAssignmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduAssignmentInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
