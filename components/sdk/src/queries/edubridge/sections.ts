import { eduSectionSelector } from '../../selectors/edubridge/sectionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Разделы каталога с уровнями в порядке справочника. */
export const name = 'edubridgeSections'

export const query = Selector('Query')({
  [name]: [{ filter: $('filter', 'EduSectionsFilterInput') }, eduSectionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['EduSectionsFilterInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
