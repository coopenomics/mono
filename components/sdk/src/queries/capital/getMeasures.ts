import { rawMeasureSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalMeasures'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetMeasuresInput!') }, rawMeasureSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetMeasuresInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
