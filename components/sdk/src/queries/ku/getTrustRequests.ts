import { kuTrustRequestsPaginationSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuTrustRequests'

/**
 * Получить список заявок доверенных лиц кооперативных участков
 */
export const query = Selector('Query')({
  [name]: [
    { filter: $('filter', 'KuTrustRequestFilterInput'), options: $('options', 'PaginationInput') },
    kuTrustRequestsPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['KuTrustRequestFilterInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
