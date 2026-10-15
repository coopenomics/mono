import { eduSectionSelector } from '../../selectors/edubridge/sectionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Добавить раздел либо переименовать. */
export const name = 'edubridgeSaveSection'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSaveSectionInput!') }, eduSectionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSaveSectionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
