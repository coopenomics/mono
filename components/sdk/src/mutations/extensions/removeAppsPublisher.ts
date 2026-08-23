import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'removeAppsPublisher'

/** Снять издателя с пакета; его ключи на пакет отзываются (487-27). */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'AppsPublisherAssignmentInputDTO!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['AppsPublisherAssignmentInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
