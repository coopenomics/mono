import { marketplaceSupplierProfileSelector } from '../../selectors/marketplace/supplierProfileSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceUpdateMySupplierProfile'

/** Поставщик правит свой профиль: название, рассказ о себе и обложку. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceUpdateSupplierProfileInput!') }, marketplaceSupplierProfileSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceUpdateSupplierProfileInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
