import { marketplaceBranchWalletOperationSelector } from '../../selectors/marketplace/economySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

/** Движения участка в одном процессе — для панели движения по общему кошельку участка. */
export const name = 'marketplaceGetBranchMovementParts'

export const query = Selector('Query')({
  [name]: [
    { braname: $('braname', 'String!'), process_hash: $('process_hash', 'String!') },
    marketplaceBranchWalletOperationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
  process_hash: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
