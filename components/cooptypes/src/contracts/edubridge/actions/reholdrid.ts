import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Повторная передача материалов занятия на ответственное хранение после
 * отказа совета (процесс p.edu.rid). Сумма, допуск и курс берутся из снятых
 * материалов: расчёт с учениками не повторяется, второй раз они не платят.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'reholdrid'

/**
 * @interface
 */
export type IReholdrid = Edubridge.IReholdrid
