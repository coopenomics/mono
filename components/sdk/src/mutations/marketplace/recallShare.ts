import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceRecallShare'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceRecallShareInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceRecallShareInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
