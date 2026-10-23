import { Ledger2Contract, SovietContract } from 'cooptypes'
import { liveTable, type ChainTableRef } from 'src/shared/lib/realtime'

/** Код стола бухгалтера в ленте изменений (имя расширения в реестре). */
const CODE = 'reports'

/**
 * Учёт кооператива: любая операция меняет остатки счетов и кошельков, по ним
 * живут счета, операции, проводки и кошельки стола бухгалтера.
 */
export const LEDGER_LIVE_TABLES: ChainTableRef[] = [
  liveTable(Ledger2Contract, Ledger2Contract.Tables.Accounts),
  liveTable(Ledger2Contract, Ledger2Contract.Tables.Wallets),
  liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
]

/** Процессы кооператива: учёт, решения совета и платежи. */
export const PROCESSES_LIVE_TABLES: ChainTableRef[] = [
  ...LEDGER_LIVE_TABLES,
  liveTable(SovietContract, SovietContract.Tables.Decisions),
  { code: 'core', table: 'payments' },
]

/** Кошельки пайщиков в программах: участие, программные кошельки, статус пайщика. */
export const PARTICIPANT_WALLETS_LIVE_TABLES: ChainTableRef[] = [
  liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
  liveTable(SovietContract, SovietContract.Tables.Programs),
  liveTable(SovietContract, SovietContract.Tables.ProgramWallets),
  liveTable(SovietContract, SovietContract.Tables.Participants),
]

/** Отчётность: сформированные отчёты, черновики, отметки о сдаче, корректировки. */
export const REPORT_DOCS_LIVE_TABLES: ChainTableRef[] = [
  'generated_reports',
  'report_drafts',
  'report_submission_marks',
  'balance_corrections',
].map((table) => ({ code: CODE, table }))

/** Удержанный НДФЛ: заявки на перечисление, общекооперативный кошелёк, платежи кассиру. */
export const NDFL_LIVE_TABLES: ChainTableRef[] = [
  liveTable(SovietContract, SovietContract.Tables.Taxes),
  liveTable(Ledger2Contract, Ledger2Contract.Tables.Wallets),
  { code: 'core', table: 'payments' },
]
