import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Команда оплаты расхода КУ из общего кошелька (раунд 5 requirement b6):
 * gateway::createoutpay → списание o.brn.spend в spendconfirm. Плановый реестр расходов
 * ведёт бэкенд; путь использования включается с шасси расходов.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'createspend'

/**
 * @interface
 */
export type ICreatespend = Branch.ICreatespend
