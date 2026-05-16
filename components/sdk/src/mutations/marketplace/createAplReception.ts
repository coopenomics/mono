import { marketplaceAplReceptionResultSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateAplReception'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceCreateAplReceptionInput!') },
    marketplaceAplReceptionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceCreateAplReceptionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
