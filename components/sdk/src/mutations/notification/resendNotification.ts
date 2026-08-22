import { rawNotificationSelector } from '../../selectors/notification/notificationSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'resendNotification'

/**
 * Переотправить уведомление (постановка новой строки в очередь доставки)
 */
export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'String!') }, rawNotificationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
