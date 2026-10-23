import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'uploadAvatar'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UploadAvatarInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['UploadAvatarInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
