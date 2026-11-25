import { contributionsPaginationSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalContributions'

/**
 * История паевых взносов пайщика в программы Благороста: деньгами, имуществом и результатами
 */
export const query = Selector('Query')({
  [name]: [{ filter: $('filter', 'CapitalContributionsFilter!'), options: $('options', 'PaginationInput') }, contributionsPaginationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter: ModelTypes['CapitalContributionsFilter']
  options?: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
