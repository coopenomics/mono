import { eduLessonSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeReportLesson'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduLessonReportInput!') }, eduLessonSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduLessonReportInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
