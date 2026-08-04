import * as Permissions from '../../../common/permissions'
import type * as Expense from '../../../interfaces/expense'
import { Actors } from '../../../common'

/**
 * createexp — создаёт и подаёт СЗ-расход. Подписывает создатель
 * (signact1 statement_doc, type=2010). См. expense.hpp::createexp.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._username }] as const

export const actionName = 'createexp'

/** @interface */
export type ICreateExp = Expense.ICreateexp
