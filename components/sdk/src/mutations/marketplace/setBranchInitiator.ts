import { marketplaceBranchInitiatorSelector } from '../../selectors/marketplace/keuSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceSetBranchInitiator'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceSetBranchInitiatorInput!') }, marketplaceBranchInitiatorSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceSetBranchInitiatorInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
