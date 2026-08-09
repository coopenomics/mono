import { marketplaceInventoryMutationResultSelector } from '../../selectors/marketplace/inventorySelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceGenerateInventoryLabel'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'MarketplaceGenerateInventoryLabelInput!') },
    marketplaceInventoryMutationResultSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceGenerateInventoryLabelInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
