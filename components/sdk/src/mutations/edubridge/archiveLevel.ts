import { eduLevelSelector } from '../../selectors/edubridge/sectionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Убрать уровень в архив либо вернуть. */
export const name = 'edubridgeArchiveLevel'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduArchiveInput!') }, eduLevelSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduArchiveInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
