import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'addAppsPublisher'

/** Назначить пайщика издателем пакета (487-27). Только chairman. */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'AppsPublisherAssignmentInputDTO!') },
    { username: true, packageId: true, addedBy: true, createdAt: true },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['AppsPublisherAssignmentInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
