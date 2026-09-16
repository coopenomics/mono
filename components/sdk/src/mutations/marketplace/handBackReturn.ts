import { marketplaceReturnClaimResultSelector } from '../../selectors/marketplace/returnClaimSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceHandBackReturn'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceHandBackReturnInput!') }, marketplaceReturnClaimResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceHandBackReturnInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
