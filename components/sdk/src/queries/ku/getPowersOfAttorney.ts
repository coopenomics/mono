import { kuPowersOfAttorneyPaginationSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuPowersOfAttorney'

/**
 * Реестр доверенностей кооператива
 */
export const query = Selector('Query')({
  [name]: [
    { filter: $('filter', 'KuPowerOfAttorneyFilterInput!'), options: $('options', 'PaginationInput') },
    kuPowersOfAttorneyPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter: ModelTypes['KuPowerOfAttorneyFilterInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
