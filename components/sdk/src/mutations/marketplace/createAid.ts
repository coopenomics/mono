import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceCreateAid'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceCreateAidInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceCreateAidInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
