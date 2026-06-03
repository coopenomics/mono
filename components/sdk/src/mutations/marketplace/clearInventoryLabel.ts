import { marketplaceInventoryMutationResultSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceClearInventoryLabel'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceClearInventoryLabelInput!') },
    marketplaceInventoryMutationResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceClearInventoryLabelInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
