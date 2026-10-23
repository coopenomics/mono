import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'revokeMyPublisherToken'

/** Отозвать свой ключ каталога (487-27). */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RevokePublisherTokenInputDTO!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RevokePublisherTokenInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
