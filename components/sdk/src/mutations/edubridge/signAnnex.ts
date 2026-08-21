import { eduAssignmentSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSignAnnex'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSignAnnexInput!') }, eduAssignmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSignAnnexInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
