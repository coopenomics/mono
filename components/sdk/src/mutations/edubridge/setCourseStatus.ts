import { eduCourseSelector } from '../../selectors/edubridge/courseSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSetCourseStatus'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSetCourseStatusInput!') }, eduCourseSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSetCourseStatusInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
