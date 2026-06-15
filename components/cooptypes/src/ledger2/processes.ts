/**
 * Реестр типов процессов ledger2 — source of truth в контракте:
 * `components/contracts/cpp/lib/core/ledger2/processes.hpp`.
 *
 * При добавлении/переименовании процесса синхронизировать обе стороны.
 *
 * Нейминг: `p.<contract>.<noun>`, где префикс `p.` — process, далее имя
 * контракта-источника (reg/wal/cap/mkt/sov/mig), затем короткое
 * существительное процесса. Длина eosio::name ≤ 12 символов.
 */
export interface ProcessMeta {
  /** Машинный идентификатор — eosio::name в контракте. */
  type: string
  /** Контракт-источник (registrator, wallet, capital, marketplace, soviet, migration). */
  contract: string
  /** Имя C++-константы в namespace processes::<contract>::. */
  name: string
  /** Человекочитаемое название для UI. */
  human_name: string
}

export const LEDGER2_PROCESS_REGISTRY: readonly ProcessMeta[] = [
  // registrator
  { type: 'p.reg.accept',   contract: 'registrator',  name: 'ACCEPT',      human_name: 'Приём пайщика' },
  { type: 'p.reg.refund',   contract: 'registrator',  name: 'REFUND',      human_name: 'Возврат регистрационного взноса при отказе совета' },

  // wallet
  { type: 'p.wal.depo',     contract: 'wallet',       name: 'DEPOSIT',     human_name: 'Внесение паевого взноса' },
  { type: 'p.wal.wthdrw',   contract: 'wallet',       name: 'WITHDRAW',    human_name: 'Возврат паевого взноса' },

  // capital
  { type: 'p.cap.import',   contract: 'capital',      name: 'IMPORT',      human_name: 'Импорт пайщика Благорост (offline)' },
  { type: 'p.cap.invest',   contract: 'capital',      name: 'INVEST',      human_name: 'Инвестиция в ЦПП «Благорост»' },
  { type: 'p.cap.debt',     contract: 'capital',      name: 'DEBT',        human_name: 'Займ пайщику' },
  { type: 'p.cap.rid',      contract: 'capital',      name: 'RID',         human_name: 'Приём РИД в паевой фонд' },
  { type: 'p.cap.prop',     contract: 'capital',      name: 'PROPERTY',    human_name: 'Приём имущественного паевого взноса' },
  { type: 'p.cap.preimp',   contract: 'capital',      name: 'PREIMP',      human_name: 'Первичный учёт РИД-взноса до перехода на электронный учёт' },
  { type: 'p.cap.wthcap',   contract: 'capital',      name: 'WTHCAP',      human_name: 'Возврат паевого из ЦПП «Благорост» в кошелёк' },
  { type: 'p.cap.pgexp',    contract: 'capital',      name: 'PGEXP',       human_name: 'Пополнение пула программных расходов' },

  // expense
  { type: 'p.exp.expns',    contract: 'expense',      name: 'PROPOSAL',    human_name: 'Расход по служебной записке' },

  // marketplace
  { type: 'p.mkt.reqst',    contract: 'marketplace',  name: 'REQUEST',     human_name: 'Запрос маркетплейса' },

  // soviet
  { type: 'p.sov.axncnv',   contract: 'soviet',       name: 'AXN_CONVERT', human_name: 'Конвертация паевого в делегатский ЧВ' },

  // migration
  { type: 'p.mig.trans',    contract: 'migration',    name: 'TRANSIT',     human_name: 'Миграция legacy → ledger2' },

  // adjustment (ручные корректировки — общий тип процесса для o.adj.walmove + o.adj.rev)
  { type: 'p.adj.fix',      contract: 'ledger2',      name: 'CORRECTION',  human_name: 'Ручная корректировка председателя' },
] as const

const processByType = new Map<string, ProcessMeta>(
  LEDGER2_PROCESS_REGISTRY.map((p) => [p.type, p]),
)

export function getProcessMeta(type: string | null | undefined): ProcessMeta | undefined {
  if (!type) return undefined
  return processByType.get(type)
}

export function getProcessHumanName(type: string | null | undefined): string | undefined {
  return getProcessMeta(type)?.human_name
}
