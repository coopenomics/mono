import { withheldTaxStateSelector } from '../../selectors/reports/withheldTaxSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getWithheldTaxState'

export const query = Selector('Query')({
  [name]: withheldTaxStateSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
