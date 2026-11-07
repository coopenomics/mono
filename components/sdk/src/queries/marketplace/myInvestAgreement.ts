import { marketplaceInvestAgreementSelector } from '../../selectors/marketplace/investSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceMyInvestAgreement'

export const query = Selector('Query')({
  [name]: marketplaceInvestAgreementSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
