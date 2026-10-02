import { eduTeacherProfileSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSaveTeacherProfile'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduTeacherProfileInput!') }, eduTeacherProfileSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduTeacherProfileInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
