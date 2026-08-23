import { rawExpenseRequisiteSelector } from '../../selectors/expense'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'expenseRequisitesByProposal'

/**
 * Снимки реквизитов получателей по строкам СЗ (только совет; персональные
 * данные хранятся офчейн в БД шасси).
 */
export const query = Selector('Query')({
  [name]: [
    { coopname: $('coopname', 'String!'), proposal_hash: $('proposal_hash', 'String!') },
    rawExpenseRequisiteSelector,
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
