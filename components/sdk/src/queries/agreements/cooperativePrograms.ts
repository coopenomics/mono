import { rawCooperativeProgramSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'cooperativePrograms'

export const query = Selector('Query')({
  [name]: [
    { coopname: $('coopname', 'String!') },
    rawCooperativeProgramSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
