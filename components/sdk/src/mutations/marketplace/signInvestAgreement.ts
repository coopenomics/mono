import { marketplaceInvestAgreementSelector } from '../../selectors/marketplace/investSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSignInvestAgreement'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSignInvestAgreementInput!') }, marketplaceInvestAgreementSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSignInvestAgreementInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
