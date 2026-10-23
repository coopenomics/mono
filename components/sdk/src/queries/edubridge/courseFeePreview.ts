import { eduCourseFeeSelector } from '../../selectors/edubridge/economySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCourseFeePreview'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'EduCourseEconomyInput!') }, eduCourseFeeSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduCourseEconomyInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
