import { marketplaceAplReceptionSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListAplReceptionsByBraname'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceListAplReceptionsByBranameInput!') }, marketplaceAplReceptionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceListAplReceptionsByBranameInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
