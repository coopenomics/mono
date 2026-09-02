import { eduPlatformCourseSelector } from '../../selectors/edubridge/courseSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgePlatformCourses'

export const query = Selector('Query')({
  [name]: [{ carrier: $('carrier', 'EduAccessCarrier!') }, eduPlatformCourseSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  carrier: ModelTypes['EduAccessCarrier']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
