import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceUnpublishStock'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceUnpublishStockInput!') }, { affected: true }],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceUnpublishStockInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
