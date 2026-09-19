import { eduCourseEconomySelector } from '../../selectors/edubridge/economySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCourseEconomy'

export const query = Selector('Query')({
  [name]: [{ course_id: $('course_id', 'ID!') }, eduCourseEconomySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  course_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
