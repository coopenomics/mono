import { rawUnreadNotificationsCountSelector } from '../../selectors/notification/inboxNotificationSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'markAllNotificationsRead'

/**
 * Отметить все уведомления инбокса прочитанными (возвращает остаток непрочитанных)
 */
export const mutation = Selector('Mutation')({
  [name]: [{ coopname: $('coopname', 'String!') }, rawUnreadNotificationsCountSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
