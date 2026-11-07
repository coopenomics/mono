import { marketplaceInvestorSelector } from '../../selectors/marketplace/investSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceMyInvestments'

export const query = Selector('Query')({
  [name]: marketplaceInvestorSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
