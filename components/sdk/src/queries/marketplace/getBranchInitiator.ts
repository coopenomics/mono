import { marketplaceBranchInitiatorSelector } from '../../selectors/marketplace/keuSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetBranchInitiator'

export const query = Selector('Query')({
  [name]: [{ braname: $('braname', 'String!') }, marketplaceBranchInitiatorSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
