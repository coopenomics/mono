import { kuDecisionsPaginationSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuDecisions'

/**
 * Получить список решений собраний кооперативных участков
 */
export const query = Selector('Query')({
  [name]: [
    { filter: $('filter', 'KuDecisionFilterInput'), options: $('options', 'PaginationInput') },
    kuDecisionsPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['KuDecisionFilterInput']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
