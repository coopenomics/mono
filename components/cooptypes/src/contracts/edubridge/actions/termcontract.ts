import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Прекращение Договора участия в хозяйственной деятельности (процесс
 * p.edu.teach): при выходе преподавателя из кооператива либо по соглашению
 * сторон. Запись договора стирается, вернувшийся пайщик подписывает его заново.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'termcontract'

/**
 * @interface
 */
export type ITermcontract = Edubridge.ITermcontract
