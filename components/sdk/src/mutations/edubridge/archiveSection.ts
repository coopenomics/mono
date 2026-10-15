import { eduSectionSelector } from '../../selectors/edubridge/sectionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Убрать раздел в архив либо вернуть. */
export const name = 'edubridgeArchiveSection'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduArchiveInput!') }, eduSectionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduArchiveInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
