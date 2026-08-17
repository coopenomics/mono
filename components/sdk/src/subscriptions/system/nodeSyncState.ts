import { rawNodeSyncStateSelector } from '../../selectors/system/nodeSyncStateSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

/**
 * Ход догона цепи узлом кооператива.
 *
 * Сервер публикует не каждый пересчёт, а смену состояния и заметное движение
 * остатка — поток не шумит. Обрыв самой подписки клиент трактует как потерю
 * связи с узлом: сообщения просто перестают приходить.
 */
export const name = 'nodeSyncState'

export const subscription = Selector('Subscription')({
  [name]: rawNodeSyncStateSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Subscription'], typeof subscription>
