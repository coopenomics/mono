import * as Permissions from '../../../common/permissions'
import type * as Ano from '../../../interfaces/ano'
import { Actors } from '../../../common'

export const authorizations = [{ permissions: [Permissions.active], actor: Actors._contract }] as const

/**
 * Имя действия
 */
export const actionName = 'pubrepschema'

/**
 * @interface
 */
export type IPubrepschema = Ano.IPubrepschema
