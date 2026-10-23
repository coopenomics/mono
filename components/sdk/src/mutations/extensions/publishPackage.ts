import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'publishPackage'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'PublishPackageInputDTO!') },
    {
      status: true,
      requestId: true,
      error: true,
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['PublishPackageInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
