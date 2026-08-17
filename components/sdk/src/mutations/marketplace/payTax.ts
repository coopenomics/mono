import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplacePayTax'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplacePayTaxInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplacePayTaxInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
