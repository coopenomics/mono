import { rawMeasureSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalCreateMeasure'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateMeasureInput!') }, rawMeasureSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateMeasureInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
