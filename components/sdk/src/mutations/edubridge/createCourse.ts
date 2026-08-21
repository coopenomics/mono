import { eduCourseSelector } from '../../selectors/edubridge/courseSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCreateCourse'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduCourseInput!') }, eduCourseSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduCourseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
