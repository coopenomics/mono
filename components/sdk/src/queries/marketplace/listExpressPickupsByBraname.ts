import { marketplaceExpressPickupCandidateSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceListExpressPickupsByBraname'

export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'MarketplaceListAplReceptionsByBranameInput!') },
    marketplaceExpressPickupCandidateSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceListAplReceptionsByBranameInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
