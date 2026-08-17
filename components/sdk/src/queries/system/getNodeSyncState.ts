import { nodeSyncStateSelector } from '../../selectors/system/nodeSyncStateSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getNodeSyncState'

/**
 * Состояние узла кооператива на текущий момент: догнал он цепь или ещё читает
 * её. Нужен на первую отрисовку — дальше состояние приходит подпиской
 * `Subscriptions.System.NodeSyncState`.
 */
export const query = Selector('Query')({
  [name]: nodeSyncStateSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
