import { rawInboxNotificationPaginationSelector } from '../../selectors/notification/inboxNotificationSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'getInboxNotifications'

/**
 * Лента личного инбокса текущего пользователя (канал In-app)
 */
export const query = Selector('Query')({
  [name]: [
    {
      coopname: $('coopname', 'String!'),
      pagination: $('pagination', 'PaginationInput!'),
    },
    rawInboxNotificationPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  pagination: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
