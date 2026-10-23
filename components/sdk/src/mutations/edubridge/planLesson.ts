import { eduLessonSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgePlanLesson'

/** Назначить занятие сверх расписания: дата, длительность, преподаватель */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduPlanLessonInput!') }, eduLessonSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduPlanLessonInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
