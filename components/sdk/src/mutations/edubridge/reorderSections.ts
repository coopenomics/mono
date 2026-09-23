import { eduSectionSelector } from '../../selectors/edubridge/sectionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Порядок разделов. */
export const name = 'edubridgeReorderSections'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduReorderInput!') }, eduSectionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduReorderInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
