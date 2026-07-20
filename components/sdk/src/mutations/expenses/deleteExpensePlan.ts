import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'deleteExpensePlan'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'DeleteExpensePlanInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['DeleteExpensePlanInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
