import { processViewSelector } from '../../selectors/processes/processViewSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'process'

export const query = Selector('Query')({
  [name]: [
    { coopname: $('coopname', 'String!'), hash: $('hash', 'String!') },
    processViewSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  hash: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
