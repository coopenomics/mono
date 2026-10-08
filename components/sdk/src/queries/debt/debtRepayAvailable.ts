import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'debtRepayAvailable'

export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
