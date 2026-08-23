import { marketplaceAplReceptionResultSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCancelAplReception'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceAplReceptionByIdInput!') },
    marketplaceAplReceptionResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceAplReceptionByIdInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
