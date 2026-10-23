import { eduLevelSelector } from '../../selectors/edubridge/sectionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Добавить уровень в раздел либо переименовать. */
export const name = 'edubridgeSaveLevel'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSaveLevelInput!') }, eduLevelSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSaveLevelInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
