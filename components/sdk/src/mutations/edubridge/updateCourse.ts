import { eduCourseSelector } from '../../selectors/edubridge/courseSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeUpdateCourse'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduUpdateCourseInput!') }, eduCourseSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduUpdateCourseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
