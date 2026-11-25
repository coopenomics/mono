import * as Permissions from '../../../common/permissions'
import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Заявление инициатора о паевом взносе имуществом в кооперативный участок (registry 1120). Задача 99D-27.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'createiprop'

/**
 * @interface
 */
export type ICreateIProp = Marketplace.ICreateIProp
