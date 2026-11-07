import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceInvestPropertyStatementSignablePayload'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceInvestPropertyStatementInput!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceInvestPropertyStatementInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
