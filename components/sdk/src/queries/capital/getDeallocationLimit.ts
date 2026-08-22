import { deallocationLimitSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalDeallocationLimit'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'CapitalDeallocationLimitInput!') }, deallocationLimitSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalDeallocationLimitInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
