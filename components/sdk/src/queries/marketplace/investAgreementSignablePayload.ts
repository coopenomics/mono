import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceInvestAgreementSignablePayload'

export const query = Selector('Query')({
  [name]: [{ braname: $('braname', 'String!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  /** Кооперативный участок договора. */
  braname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
