import { marketplaceAplReceptionResultSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSignAplReceptionAsSupplier'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceSignAplReceptionInput!') },
    marketplaceAplReceptionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSignAplReceptionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
