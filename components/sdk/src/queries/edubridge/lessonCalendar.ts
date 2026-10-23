import { eduLessonSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeLessonCalendar'

/** Календарь занятий школы: по курсу, группе, преподавателю и окну дат */
export const query = Selector('Query')({
  [name]: [{ filter: $('filter', 'EduLessonCalendarFilter') }, eduLessonSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['EduLessonCalendarFilter'] | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
