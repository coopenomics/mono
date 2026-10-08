import { eduCourseEconomySelector } from '../../selectors/edubridge/economySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCourseEconomy'

export const query = Selector('Query')({
  [name]: [{ course_id: $('course_id', 'ID!'), group_id: $('group_id', 'ID') }, eduCourseEconomySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  course_id: string
  /** Группа курса; не названа — первая идущая */
  group_id?: string | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
