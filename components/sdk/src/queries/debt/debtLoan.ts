import { loanSelector } from '../../selectors/debt'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'debtLoan'

export const query = Selector('Query')({
  [name]: [{ debt_hash: $('debt_hash', 'String!') }, loanSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  debt_hash: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
