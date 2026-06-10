import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetTrusteeWeight'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetTrusteeWeightInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetTrusteeWeightInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
