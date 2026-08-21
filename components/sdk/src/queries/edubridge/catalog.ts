import { eduCatalogCoursesPaginationResultSelector } from '../../selectors/edubridge/courseSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCatalog'

export const query = Selector('Query')({
  [name]: [
    { filter: $('filter', 'EduCatalogFilterInput'), options: $('options', 'PaginationInput') },
    eduCatalogCoursesPaginationResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['EduCatalogFilterInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
