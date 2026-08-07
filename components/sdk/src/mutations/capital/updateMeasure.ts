import { rawMeasureSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalUpdateMeasure'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UpdateMeasureInput!') }, rawMeasureSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['UpdateMeasureInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
