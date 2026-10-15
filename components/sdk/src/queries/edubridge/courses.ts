import { eduCoursesPaginationResultSelector } from '../../selectors/edubridge/courseSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCourses'

export const query = Selector('Query')({
  [name]: [
    { filter: $('filter', 'EduCoursesFilterInput'), options: $('options', 'PaginationInput') },
    eduCoursesPaginationResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['EduCoursesFilterInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
