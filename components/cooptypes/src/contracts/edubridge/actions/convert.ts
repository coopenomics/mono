import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Конвертация паевого взноса пайщика в членский кошелёк «Образования» (w.edu.member).
 * Один шаг ledger2: o.edu.conv (TRANSFER w.wal.share → w.edu.member, Дт 80 / Кт 86).
 * Заявление о конвертации подписывает пайщик, отправляет бэкенд ключом кооператива.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'convert'

/**
 * @interface
 */
export type IConvert = Edubridge.IConvert
