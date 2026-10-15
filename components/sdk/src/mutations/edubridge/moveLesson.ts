import { eduLessonSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeMoveLesson'

/** Перенести запланированное занятие: дата, длительность, преподаватель, тема */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduMoveLessonInput!') }, eduLessonSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduMoveLessonInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
