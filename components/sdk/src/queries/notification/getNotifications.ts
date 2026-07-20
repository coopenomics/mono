import { rawNotificationPaginationSelector } from '../../selectors/notification/notificationSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'getNotifications'

/**
 * Журнал уведомлений кооператива (стол председателя): фильтры + пагинация
 */
export const query = Selector('Query')({
  [name]: [
    {
      filter: $('filter', 'NotificationsFilterInput!'),
      pagination: $('pagination', 'PaginationInput!'),
    },
    rawNotificationPaginationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter: ModelTypes['NotificationsFilterInput']
  pagination: ModelTypes['PaginationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
