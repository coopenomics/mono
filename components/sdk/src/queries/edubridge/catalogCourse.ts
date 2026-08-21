import { eduCatalogCourseSelector } from '../../selectors/edubridge/courseSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCatalogCourse'

export const query = Selector('Query')({
  [name]: [
    { id: $('id', 'ID!') },
    eduCatalogCourseSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
