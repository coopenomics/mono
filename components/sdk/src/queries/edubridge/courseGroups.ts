import { eduGroupSelector } from '../../selectors/edubridge/groupSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCourseGroups'

/** Группы курса */
export const query = Selector('Query')({
  [name]: [{ course_id: $('course_id', 'ID!') }, eduGroupSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  course_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
