import type * as Expense from '../../../interfaces/expense'
import { Actors } from '../../../common'

/**
 * Таблица СЗ-расходов. Scope = coopname.
 * On-chain индексы: byhash (proposal_hash), byusername (username), bystatus (status).
 */
export const tableName = 'proposals'

export const scope = Actors._coopname

/** @interface */
export type IProposal = Expense.IProposal
