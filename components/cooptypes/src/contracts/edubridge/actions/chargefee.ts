import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Списание членского взноса ученика в фонд программы при открытии и продлении
 * подписки. Один шаг ledger2: o.edu.fee (TRANSFER w.edu.member → w.edu.fund,
 * без проводки — оба на счёте 86). Отправляет бэкенд ключом кооператива.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'chargefee'

/**
 * @interface
 */
export type IChargefee = Edubridge.IChargefee
