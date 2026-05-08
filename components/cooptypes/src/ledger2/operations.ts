/**
 * Реестр именованных операций ledger2 — source of truth в контракте:
 * `components/contracts/cpp/lib/core/ledger2/operations.hpp` (`OPERATION_REGISTRY`).
 *
 * При добавлении/переименовании операции синхронизировать обе стороны + при
 * необходимости `cpp/lib/core/ledger2/{wallets.hpp,accounts.hpp}`.
 *
 * Нейминг: `o.<contract>.<verb>`, где префикс `o.` — operation, далее имя
 * контракта-источника (reg/wal/cap/mkt/sov/mig), затем короткий глагол.
 * Длина eosio::name ≤ 12 символов (13-й символ имеет ограничение по алфавиту).
 *
 * Идентификаторы кошельков (`wallet_from`/`wallet_to`) — eosio::name с
 * префиксом `w.<contract>.<waltype>` (см. `./wallets.ts`). Пустая строка
 * (`""`) — sentinel «кошелёк вне системы» для ISSUE и BURN.
 */
import type { IName } from '../interfaces/ledger2'

export type WalletOp = 'ISSUE' | 'TRANSFER' | 'BLOCK' | 'UNBLOCK' | 'BURN'

export interface OperationMeta {
  /** Машинный идентификатор — eosio::name в контракте. */
  code: string
  /** Контрактный `process_type`, связанный с этой операцией. */
  process_type: string
  /** Контракт-источник. */
  contract: string
  /** Имя C++-константы в namespace operations::<contract>::. */
  name: string
  /**
   * Тип операции по кошельку. Для `kind: 'adjustment'` — null, потому что
   * реальный wallet_op зависит от исходной операции (WALMOVE = TRANSFER без Dr/Cr,
   * REVERSAL = TRANSFER/BURN в зависимости от зеркала).
   */
  wallet_op: WalletOp | null
  /** Кошелёк-источник (null для ISSUE и для adjustment-операций). */
  wallet_from: IName | null
  /** Кошелёк-приёмник (null для BLOCK/UNBLOCK/BURN и для adjustment-операций). */
  wallet_to: IName | null
  /** Код счёта Дт (null без бухпроводки, ADR-003: ⇔ credit == null). */
  debit: number | null
  /** Код счёта Кт (null без бухпроводки, ADR-003: ⇔ debit == null). */
  credit: number | null
  /** Человекочитаемое название для UI. */
  human_name: string
  /**
   * Тип операции:
   *   - `'standard'` (default) — параметры зашиты в контрактном OPERATION_REGISTRY,
   *     вызывается через `ledger2::apply`.
   *   - `'adjustment'` — параметры задаются динамически каждый вызов; не входит
   *     в контрактный OPERATION_REGISTRY; вызывается отдельным action
   *     (`ledger2::walmove` для WALMOVE, `ledger2::revert` для REVERSAL).
   *     UI запрещает таким операциям обычные пути и подсвечивает фильтром
   *     «Только корректировки».
   */
  kind?: 'standard' | 'adjustment'
}

export const LEDGER2_OPERATION_REGISTRY: readonly OperationMeta[] = [
  // registrator
  { code: 'o.reg.payent',  process_type: 'p.reg.accept',  contract: 'registrator',
    name: 'PAY_ENTRANCE',   wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.reg.entry',
    debit: 51, credit: 86,
    human_name: 'Вступительный взнос пайщика' },

  { code: 'o.reg.putmin',  process_type: 'p.reg.accept',  contract: 'registrator',
    name: 'PUT_MINSHARE',   wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.reg.minshr',
    debit: 51, credit: 80,
    human_name: 'Минимальный паевой взнос пайщика при регистрации' },

  // wallet
  { code: 'o.wal.depcpl',  process_type: 'p.wal.depo',    contract: 'wallet',
    name: 'COMPLETE_DEPOSIT',  wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.wal.share',
    debit: 51, credit: 80,
    human_name: 'Внесение пайщиком паевого взноса' },

  { code: 'o.wal.wthreq',  process_type: 'p.wal.wthdrw',  contract: 'wallet',
    name: 'REQUEST_WITHDRAW',  wallet_op: 'BLOCK',    wallet_from: 'w.wal.share', wallet_to: null,
    debit: null, credit: null,
    human_name: 'Блокировка паевого под запрос на возврат' },

  { code: 'o.wal.wthdec',  process_type: 'p.wal.wthdrw',  contract: 'wallet',
    name: 'DECLINE_WITHDRAW',  wallet_op: 'UNBLOCK',  wallet_from: 'w.wal.share', wallet_to: null,
    debit: null, credit: null,
    human_name: 'Разблокировка паевого после отклонения запроса на возврат' },

  { code: 'o.wal.wthcpl',  process_type: 'p.wal.wthdrw',  contract: 'wallet',
    name: 'COMPLETE_WITHDRAW', wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.wal.wthdrw',
    debit: 80, credit: 51,
    human_name: 'Возврат паевого взноса пайщику' },

  // capital (ADR-009: единые программные кошельки `w.cap.blago`/`w.cap.gen`)
  { code: 'o.cap.import',  process_type: 'p.cap.import',  contract: 'capital',
    name: 'IMPORT',         wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.cap.blago',
    debit: 51, credit: 80,
    human_name: 'Паевой взнос по ЦПП «Благорост» (офлайн-импорт)' },

  { code: 'o.cap.invest',  process_type: 'p.cap.invest',  contract: 'capital',
    name: 'INVEST',         wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.cap.blago',
    debit: null, credit: null,
    human_name: 'Инвестиция в ЦПП «Благорост» (перенос между кошельками)' },

  { code: 'o.cap.commit',  process_type: 'p.cap.rid',     contract: 'capital',
    name: 'COMMIT_RID',     wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.cap.gen',
    debit: 8, credit: 80,
    human_name: 'Коммит РИД по программе «Благорост»' },

  { code: 'o.cap.accept',  process_type: 'p.cap.rid',     contract: 'capital',
    name: 'ACCEPT_RID',     wallet_op: 'TRANSFER', wallet_from: 'w.cap.gen', wallet_to: 'w.cap.blago',
    debit: 4, credit: 8,
    human_name: 'Приём РИД в паевой фонд' },

  { code: 'o.cap.actprp',  process_type: 'p.cap.prop',    contract: 'capital',
    name: 'ACCEPT_PROPERTY', wallet_op: 'ISSUE',   wallet_from: null, wallet_to: 'w.cap.blago',
    debit: 51, credit: 80,
    human_name: 'Паевой взнос (имущественный) по программе «Благорост»' },

  { code: 'o.cap.lend',    process_type: 'p.cap.debt',    contract: 'capital',
    name: 'LEND',           wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.cap.loan',
    debit: 58, credit: 51,
    human_name: 'Выдача пайщику беспроцентного займа' },

  { code: 'o.cap.repay',   process_type: 'p.cap.rid',     contract: 'capital',
    name: 'REPAY',          wallet_op: 'TRANSFER', wallet_from: 'w.cap.loan', wallet_to: 'w.wal.share',
    debit: 80, credit: 58,
    human_name: 'Возврат беспроцентного займа пайщика по акту-2' },

  { code: 'o.cap.wthcap',  process_type: 'p.cap.wthcap',  contract: 'capital',
    name: 'WITHDRAW_FROM_CAPITAL', wallet_op: 'TRANSFER', wallet_from: 'w.cap.blago', wallet_to: 'w.wal.share',
    debit: null, credit: null,
    human_name: 'Возврат паевого из ЦПП «Благорост» в Цифровой Кошелёк' },

  // marketplace
  { code: 'o.mkt.supply',  process_type: 'p.mkt.reqst',   contract: 'marketplace',
    name: 'CONFIRM_SUPPLY', wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.wal.share',
    debit: 51, credit: 80,
    human_name: 'Подтверждение поставки' },

  { code: 'o.mkt.recv',    process_type: 'p.mkt.reqst',   contract: 'marketplace',
    name: 'CONFIRM_RECEIPT', wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.mkt.payout',
    debit: 80, credit: 51,
    human_name: 'Подтверждение получения — выплата поставщику' },

  // soviet
  { code: 'o.sov.axncnv',  process_type: 'p.sov.axncnv',  contract: 'soviet',
    name: 'CONVERT_AXN',    wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.sov.delgte',
    debit: 80, credit: 86,
    human_name: 'Трансляция паевого в членский взнос инфраструктуры' },

  // migration
  { code: 'o.mig.minshr',  process_type: 'p.mig.trans',   contract: 'migration',
    name: 'MIN_SHARE',      wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.reg.minshr',
    debit: 51, credit: 80,
    human_name: 'Транзит: минимальные паевые взносы' },

  { code: 'o.mig.share',   process_type: 'p.mig.trans',   contract: 'migration',
    name: 'SHARE',          wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.wal.share',
    debit: 51, credit: 80,
    human_name: 'Транзит: остаток паевых взносов деньгами' },

  { code: 'o.mig.entry',   process_type: 'p.mig.trans',   contract: 'migration',
    name: 'ENTRY',          wallet_op: 'ISSUE',    wallet_from: null, wallet_to: 'w.reg.entry',
    debit: 51, credit: 86,
    human_name: 'Транзит: вступительные взносы' },

  // adjustment (ручные корректировки председателя — динамические параметры,
  // не идут через ledger2::apply; см. operations.hpp `OPERATION_ADJUSTMENT_REGISTRY`).
  { code: 'o.adj.walmove', process_type: 'p.adj.fix',     contract: 'ledger2',
    name: 'WALMOVE',        wallet_op: null,       wallet_from: null, wallet_to: null,
    debit: null, credit: null,
    human_name: 'Перевод между кошельками',
    kind: 'adjustment' },

  { code: 'o.adj.rev',     process_type: 'p.adj.fix',     contract: 'ledger2',
    name: 'REVERSAL',       wallet_op: null,       wallet_from: null, wallet_to: null,
    debit: null, credit: null,
    human_name: 'Откат операции',
    kind: 'adjustment' },
] as const

const opByCode = new Map<string, OperationMeta>(
  LEDGER2_OPERATION_REGISTRY.map((o) => [o.code, o]),
)

export function getOperationMeta(code: string | null | undefined): OperationMeta | undefined {
  if (!code) return undefined
  return opByCode.get(code)
}

export function getOperationProcessType(code: string | null | undefined): string | undefined {
  return getOperationMeta(code)?.process_type
}

export function getOperationHumanName(code: string | null | undefined): string | undefined {
  return getOperationMeta(code)?.human_name
}

/**
 * Корректировка председателя (`o.adj.*`) — операция с динамическими параметрами,
 * вызываемая отдельными actions ledger2::walmove / ledger2::revert. UI использует
 * это для фильтра «Только корректировки» и для запрета обычных путей.
 */
export function isAdjustmentOperation(code: string | null | undefined): boolean {
  return !!code && code.startsWith('o.adj.')
}
