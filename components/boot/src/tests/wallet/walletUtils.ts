import { FundContract, Ledger2, LedgerContract, SovietContract, WalletContract } from 'cooptypes'
import { expect } from 'vitest'
import type Blockchain from '../../blockchain'
import { circulationAccountId } from '../capital/consts'

// Имя контракта ledger2 пока не вынесено в cooptypes (пакет ещё не обновлён).
const _ledger2Contract = 'ledger2'

// Типы счетов ledger2 (AccountType::ACTIVE = 0, PASSIVE = 1, ACTIVE_PASSIVE = 2).
export enum LedgerAccountType {
  ACTIVE = 0,
  PASSIVE = 1,
  ACTIVE_PASSIVE = 2,
}

/**
 * Кошелёк пайщика по программе.
 *
 * Читается из `ledger2::userwallets` (L3), а НЕ из `soviet::progwallets`:
 * последняя осталась в ABI, но пустует — балансы пайщиков уехали в ledger2.
 * Пока хелпер ходил в неё, он всегда возвращал undefined, и capital.test.ts
 * падал каскадом начиная с проверки пополнения кошелька.
 *
 * Соответствие «программа → кошельки» берётся из реестра cooptypes
 * (`LEDGER2_USER_SHARED_PROGRAM_MAPPING`), а не хардкодится: у одной программы
 * может быть несколько кошельков (ЦК = паевой + членский), и тогда балансы
 * складываются — ровно так же, как их видел единственный progwallets-ряд.
 * Форма возврата сохранена (`program_id` / `available` / `blocked`), чтобы
 * вызывающий код не переписывался.
 */
export async function getUserProgramWallet(blockchain: any, coopname: string, username: string, program_id: number) {
  const walletNames = Ledger2.LEDGER2_USER_SHARED_PROGRAM_MAPPING
    .filter((m: any) => m.required_program_id === program_id)
    .map((m: any) => m.wallet_name as string)

  if (walletNames.length === 0) return undefined

  const rows = await blockchain.getTableRows(_ledger2Contract, coopname, 'userwallets', 1000) as Array<{
    wallet_name: string
    username: string
    available: string
    blocked: string
  }>

  const mine = rows.filter(r => r.username === username && walletNames.includes(r.wallet_name))
  // Кошелька может не быть вовсе (пайщик не входил в программу) — как и раньше,
  // отдаём undefined: вызывающий код это различает.
  if (mine.length === 0) return undefined

  const sum = (field: 'available' | 'blocked') =>
    mine.reduce((acc, r) => acc + Number.parseFloat(String(r[field]).split(' ')[0]), 0)

  return {
    program_id,
    username,
    available: `${sum('available').toFixed(4)} RUB`,
    blocked: `${sum('blocked').toFixed(4)} RUB`,
  }
}

export async function getUserProgramWalletAmount(blockchain: any, coopname: string, username: string, program_id: number) {
  const wallet = await getUserProgramWallet(blockchain, coopname, username, program_id)
  return wallet ? `${(parseFloat(wallet.available) + parseFloat(wallet.blocked)).toFixed(4)} RUB` : '0.0000 RUB'
}

export async function getCoopProgramWallet(blockchain: any, coopname: string, program_id: number) {
  const program = await blockchain.getTableRows(
    SovietContract.contractName.production,
    coopname,
    'programs',
    1000,
    program_id.toString(),
    program_id.toString(),
  )

  return program[0]
}

/**
 * Возвращает строковый баланс счёта ledger2 с учётом активности/пассивности:
 *  - ACTIVE:         balance = debit_balance - credit_balance
 *  - PASSIVE:        balance = credit_balance - debit_balance
 *  - ACTIVE_PASSIVE: balance = debit_balance - credit_balance (знаковый)
 *
 * Результат сериализуется как "{amount} {symbol}" — тот же формат, что был
 * в legacy ledger::laccount.available, чтобы downstream .split(' ')[0]
 * продолжал работать без изменений.
 */
function ledger2AccountBalance(account: any): string {
  const debit = parseFloat(String(account.debit_balance).split(' ')[0])
  const credit = parseFloat(String(account.credit_balance).split(' ')[0])
  const symbol = String(account.debit_balance).split(' ')[1] || 'RUB'
  const type = Number(account.account_type) as LedgerAccountType

  const raw = type === LedgerAccountType.PASSIVE ? credit - debit : debit - credit
  return `${raw.toFixed(4)} ${symbol}`
}

/**
 * Возвращает записи ledger2::accounts, но мапит их под legacy-форму
 * `{ id, name, available, blocked }`, чтобы существующие тесты оставались
 * без изменений. `available` синтезируется из credit/debit оборотов с учётом
 * `account_type`; `blocked` всегда '0.0000 RUB' (в ledger2 блокировка
 * фиксируется на кошельках, не на счетах).
 */
export async function getLedgerAccounts(blockchain: Blockchain, coopname: string) {
  const rows = await blockchain.getTableRows(
    _ledger2Contract,
    coopname,
    'accounts',
    200,
  )

  return rows.map((account: any) => ({
    id: account.id,
    name: account.name,
    available: ledger2AccountBalance(account),
    blocked: '0.0000 RUB',
    debit_balance: account.debit_balance,
    credit_balance: account.credit_balance,
    account_type: account.account_type,
  }))
}

export async function getLedgerAccountById(blockchain: Blockchain, coopname: string, accountId: number) {
  const accounts = await getLedgerAccounts(blockchain, coopname)
  // Счёт в ledger2::accounts создаётся лениво при первой проводке, поэтому
  // до появления записи возвращаем нулевой плейсхолдер — чтобы даунстрим
  // мог безопасно обращаться к .available/.blocked.
  return accounts.find((account: any) => account.id === accountId) || {
    id: accountId,
    available: '0.0000 RUB',
    blocked: '0.0000 RUB',
    debit_balance: '0.0000 RUB',
    credit_balance: '0.0000 RUB',
  }
}

export async function getCirculationAccount(blockchain: Blockchain, coopname: string) {
  const accounts = await getLedgerAccounts(blockchain, coopname)
  return accounts.find((account: any) => account.id === circulationAccountId) || { available: '0.0000 RUB' }
}

export async function getCoopWallet(blockchain: any, coopname: string) {
  return (await blockchain.getTableRows(
    FundContract.contractName.production,
    coopname,
    'coopwallet',
    1,
  ))[0]
}

export async function getDeposit(blockchain: Blockchain, coopname: string, deposit_hash: string) {
  return (await blockchain.getTableRows(
    WalletContract.contractName.production,
    coopname,
    WalletContract.Tables.Deposits.tableName,
    1,
    deposit_hash,
    deposit_hash,
    2,
    'sha256',
  ))[0]
}

export function compareTokenAmounts(prevAmount: string, currentAmount: string, expectedIncrease: number): void {
  const prev = parseFloat(prevAmount.split(' ')[0])
  const current = parseFloat(currentAmount.split(' ')[0])
  const expected = prev + expectedIncrease

  expect(current).toBeCloseTo(expected, 4)
}
