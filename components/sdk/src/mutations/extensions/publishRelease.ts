import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'publishRelease'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'PublishReleaseInputDTO!') },
    {
      status: true,
      requestId: true,
      transactionId: true,
      error: true,
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['PublishReleaseInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
