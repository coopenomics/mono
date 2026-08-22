import { rawNotificationDetailSelector } from '../../selectors/notification/notificationSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getNotification'

/**
 * Детализация одного уведомления с историей попыток доставки
 */
export const query = Selector('Query')({
  [name]: [{ id: $('id', 'String!') }, rawNotificationDetailSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
