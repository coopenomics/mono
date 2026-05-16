import { marketplaceAplReceptionResultSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSignAplReceptionAsChairman'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceSignAplReceptionInput!') },
    marketplaceAplReceptionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceSignAplReceptionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
