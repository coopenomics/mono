import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceInvestStatementSignablePayload'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceInvestStatementInput!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceInvestStatementInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
