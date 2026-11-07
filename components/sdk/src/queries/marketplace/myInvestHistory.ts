import { marketplaceInvestHistoryPaginationSelector } from '../../selectors/marketplace/investSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceMyInvestHistory'

export const query = Selector('Query')({
  [name]: [{ options: $('options', 'PaginationInput') }, marketplaceInvestHistoryPaginationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
