import { documentSelector } from '../../selectors/common/documentSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceInvestAgreementSignablePayload'

export const query = Selector('Query')({
  [name]: documentSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
