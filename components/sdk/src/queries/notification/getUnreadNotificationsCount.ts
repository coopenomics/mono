import { rawUnreadNotificationsCountSelector } from '../../selectors/notification/inboxNotificationSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getUnreadNotificationsCount'

/**
 * Число непрочитанных уведомлений в инбоксе (бейдж на колоколе)
 */
export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!') }, rawUnreadNotificationsCountSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
