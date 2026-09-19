import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCancelCourseUnderfilled'

export const mutation = Selector('Mutation')({
  [name]: [{ course_id: $('course_id', 'ID!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  course_id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
