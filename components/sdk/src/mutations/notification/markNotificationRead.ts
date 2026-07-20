import { rawInboxNotificationSelector } from '../../selectors/notification/inboxNotificationSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'markNotificationRead'

/**
 * Отметить уведомление инбокса прочитанным
 */
export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'String!') }, rawInboxNotificationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
