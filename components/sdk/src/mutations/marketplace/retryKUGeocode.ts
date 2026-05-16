import { marketplaceKUDetailsSelector } from '../../selectors/marketplace'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceRetryKUGeocode'

export const mutation = Selector('Mutation')({
  [name]: [
    { coopname: $('coopname', 'String!'), coreBraname: $('coreBraname', 'String!') },
    marketplaceKUDetailsSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  coreBraname: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
