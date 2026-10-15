import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Преподаватель подаёт заявление о внесении паевого взноса результатом
 * интеллектуальной деятельности (процесс p.edu.rid). Запись ждёт решения совета.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'submitrid'

/**
 * @interface
 */
export type ISubmitrid = Edubridge.ISubmitrid
