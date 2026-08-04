import { expenseProposalSelector } from '../../selectors/expense'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'expenseProposal'

export const query = Selector('Query')({
  [name]: [{ proposal_hash: $('proposal_hash', 'String!') }, expenseProposalSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  proposal_hash: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
