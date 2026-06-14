import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'revokeSession'

/**
 * Завершить конкретную сессию пайщика.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RevokeSessionInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RevokeSessionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
