import { processContentSelector } from '../../selectors/processes/processContentSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'reportsProcessContent'

export const query = Selector('Query')({
  [name]: [
    {
      coopname: $('coopname', 'String!'),
      hash: $('hash', 'String!'),
      process_type: $('process_type', 'String!'),
    },
    processContentSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  hash: string
  process_type: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
