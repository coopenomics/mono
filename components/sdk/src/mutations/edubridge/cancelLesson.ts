import { eduLessonSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCancelLesson'

/** Отменить запланированное занятие: номер и место в программе свободны */
export const mutation = Selector('Mutation')({
  [name]: [{ lesson_id: $('lesson_id', 'ID!') }, eduLessonSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  lesson_id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
