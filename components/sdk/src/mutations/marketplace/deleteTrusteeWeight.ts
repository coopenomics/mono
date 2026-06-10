import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceDeleteTrusteeWeight'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceDeleteTrusteeWeightInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceDeleteTrusteeWeightInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
