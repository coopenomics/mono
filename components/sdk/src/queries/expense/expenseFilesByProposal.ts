import { rawExpenseFileSelector } from '../../selectors/expense'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'expenseFilesByProposal'

export const query = Selector('Query')({
  [name]: [
    { coopname: $('coopname', 'String!'), proposal_hash: $('proposal_hash', 'String!') },
    rawExpenseFileSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  proposal_hash: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
