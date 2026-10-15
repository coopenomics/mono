import { eduLessonSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeGroupLessons'

/** Занятия группы для участника: что было и что будет */
export const query = Selector('Query')({
  [name]: [{ group_id: $('group_id', 'ID!') }, eduLessonSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  group_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
