import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'approveModeration'

/**
 * Операторский approve заявки на модерацию (Story 9.9):
 * заявка → APPROVED, релиз → ACTIVE, on-chain setrelease + outbox release.activated.
 */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'ApproveModerationInputDTO!') },
    {
      status: true,
      packageId: true,
      version: true,
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

  data: ModelTypes['ApproveModerationInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
