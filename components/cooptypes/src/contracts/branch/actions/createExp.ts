import * as Permissions from '../../../common/permissions'
import type * as Branch from '../../../interfaces/branch'
import { Actors } from '../../../common'

/**
 * Подача расхода кооперативного участка в шасси расходов: сумма служебной
 * записки уходит из общего кошелька участка в пул расходов (o.brn.expfnd),
 * дальше записку ведёт шасси — решение совета, оплата по реквизитам либо
 * аванс под отчёт, отчёт с чеками, закрытие.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

/**
 * Имя действия
 */
export const actionName = 'createexp'

/**
 * @interface
 */
export type ICreateexp = Branch.ICreateexp
