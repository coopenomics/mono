import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceInvestPropertyActSignablePayload'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceInvestPropertyRefInput!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceInvestPropertyRefInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
