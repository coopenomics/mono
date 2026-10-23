import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'rejectModeration'

/** Операторский reject заявки на модерацию с причиной (Story 9.9). */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'RejectModerationInputDTO!') },
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

  data: ModelTypes['RejectModerationInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
