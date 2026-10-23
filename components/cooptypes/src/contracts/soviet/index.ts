import * as contractNames from '../../common/names'
import { actionName as voteAgainstAction } from './actions/decisions/voteAgainst'
import { actionName as voteForAction } from './actions/decisions/voteFor'

export * as Actions from './actions'
export * as Tables from './tables'

/**
 * @private
 */
export * as Interfaces from '../../interfaces/soviet'

export const contractName = contractNames._soviet

/**
 * Действия совета, которые робот подписывает ключом отдельного разрешения члена
 * совета.
 *
 * При делегировании разрешение привязывается (`linkauth`) к каждому действию из
 * списка, при отзыве — обязано быть отвязано (`unlinkauth`) от каждого: цепь не
 * даёт удалить разрешение, пока на нём висит хотя бы одна привязка
 * («Cannot delete a linked authority»). Список один на всех — предустановку
 * стенда, рабочий стол и тесты, — чтобы привязки и отвязки не разошлись.
 */
export const robotLinkedActions: readonly string[] = [voteForAction, voteAgainstAction]
