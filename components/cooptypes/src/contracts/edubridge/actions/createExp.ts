import * as Permissions from '../../../common/permissions'
import type * as Edubridge from '../../../interfaces/edubridge'
import { Actors } from '../../../common'

/**
 * Подача расхода ЦПП «Образование» в шасси расходов: сумма служебной записки
 * уходит из фонда программы в пул расходов (o.edu.expfnd), дальше записку
 * ведёт шасси — решение совета, оплата по реквизитам либо аванс под отчёт,
 * отчёт с чеками, закрытие.
 */
export const authorizations = [{ permissions: [Permissions.active], actor: Actors._coopname }] as const

export const actionName = 'createexp'

/**
 * @interface
 */
export type ICreateexp = Edubridge.ICreateexp
