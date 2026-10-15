import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Обратный вызов от soviet::declinedec / cancelexprd: совет отказал в приёме
 * паевого взноса результатом интеллектуальной деятельности либо снял вопрос по
 * сроку (процесс p.edu.rid). Материалы с хранения снимает председатель. require_auth(_soviet).
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

export const actionName = 'onriddecl'

/**
 * @interface
 */
export type IOnRidDecl = Edubridge.IOnRidDecl
