/**
 * Трансляция паевого взноса из Благороста в Цифровой Кошелёк (реестр
 * capital.share-transfer).
 *
 * Закрытая страница стола Благороста: её видят председатель и пайщики с ролью
 * «Трансляция паевого взноса». Пайщик называет сумму, подписывает заявление
 * 1090, сервер отправляет `capital::wthshare` — сумма переходит с кошелька
 * Благороста на главный паевой. Остаток в Благорост пайщику даёт импорт
 * председателем (без настройки денег программы, как у пайщика до перехода на
 * электронный учёт).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, caseName, expectCode, freshMember, gql, gqlError, login, signDocument, tableRows, tokenOf } from '../core'
import { ensureCapitalProgram } from './cap-results.helpers'

const ROLE = 'blagorost-transfer'
const IMPORT = 'mutation($d:ImportContributorInput!){ capitalImportContributor(data:$d){ __typename } }'
const ASSIGN = 'mutation($d:RoleAssignmentInput!){ assignRole(data:$d){ key } }'
const REVOKE = 'mutation($d:RoleAssignmentInput!){ revokeRole(data:$d){ key } }'
const DESKTOP = 'query{ getDesktop{ workspaces{ name grants } } }'
const STATE = 'query($d:CapitalShareTransferStateInput!){ capitalShareTransferState(data:$d){ username blagorost_balance } }'
const GENERATE = 'mutation($d:ShareTransferStatementGenerateDocumentInput!){ capitalGenerateCapitalizationToMainWalletConvertStatement(data:$d){ full_title html hash meta binary } }'
const TRANSFER = 'mutation($d:CapitalTransferShareInput!){ capitalTransferShare(data:$d){ username blagorost_balance } }'
const HISTORY = 'query($f:CapitalShareTransferFilter){ capitalShareTransfers(filter:$f, options:{ page:1, limit:20, sortOrder:"DESC" }){ totalCount items{ username amount statement_hash transaction_id } } }'

let chairman = ''

const num = (asset: string) => Number.parseFloat(asset)

async function chainBalance(username: string, wallet: string): Promise<number> {
  const rows = await tableRows<any>('ledger2', COOP, 'userwallets')
  const row = rows.find(r => r.username === username && r.wallet_name === wallet)
  return row ? num(row.available) : 0
}

async function capitalGrants(token: string): Promise<string[]> {
  const desk = (await gql<any>(token, DESKTOP)).getDesktop
  return desk.workspaces.find((w: any) => w.name === 'capital')?.grants ?? []
}

/** Пайщик с остатком в Благоросте: импорт председателем. */
async function memberWithBlagorost(prefix: string, amount: string): Promise<Who> {
  const who = freshMember({ prefix })
  await gql(chairman, IMPORT, { d: {
    coopname: COOP,
    username: who.account,
    contribution_amount: amount,
    contributor_contract_number: `УХД-${who.account}`,
    contributor_contract_created_at: '01.10.2026',
    blagorost_agreement_number: `БР-${who.account}`,
    blagorost_agreement_created_at: '01.10.2026',
    memo: 'остаток для трансляции',
  } })
  return who
}

async function signedStatement(token: string, who: Who, amount: string): Promise<any> {
  const doc = (await gql<any>(token, GENERATE, { d: { coopname: COOP, username: who.account, amount } }))
    .capitalGenerateCapitalizationToMainWalletConvertStatement
  return { doc, signed: await signDocument(who.wif, doc, who.account) }
}

const transferInput = (who: Who, amount: string, statement: unknown) => ({ d: { coopname: COOP, username: who.account, amount, statement } })

describe('Благорост: трансляция паевого взноса в Цифровой Кошелёк', () => {
  let holder: Who
  let holderToken = ''

  beforeAll(async () => {
    await ensureCapitalProgram()
    chairman = await tokenOf(CHAIRMAN)
    holder = await memberWithBlagorost('sht', '3000.0000 RUB')
    await gql(chairman, ASSIGN, { d: { username: holder.account, role: ROLE } })
    holderToken = await login(holder)
  })

  it(caseName('cap.share-transfer.side.04', 'страница есть у председателя и у пайщика с ролью, у пайщика без роли её нет'), async () => {
    const other = freshMember({ prefix: 'sht' })
    expect(await capitalGrants(chairman)).toContain('CapitalDesk:transfer')
    expect(await capitalGrants(holderToken)).toContain('CapitalDesk:transfer')
    const otherToken = await login(other)
    expect(await capitalGrants(otherToken)).not.toContain('CapitalDesk:transfer')
    expectCode(await gqlError(otherToken, STATE, { d: { username: other.account } }), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(otherToken, HISTORY, { f: { username: other.account } }), 'KIT_INSUFFICIENT_RIGHTS')
  })

  it(caseName('cap.share-transfer.happy.01', 'часть остатка уходит на главный паевой, повтор заявления отклоняется до цепи'), async () => {
    const before = (await gql<any>(holderToken, STATE, { d: { username: holder.account } })).capitalShareTransferState
    expect(num(before.blagorost_balance)).toBe(3000)
    const shareBefore = await chainBalance(holder.account, 'w.wal.share')

    const { doc, signed } = await signedStatement(holderToken, holder, '1000.0000 RUB')
    expect(doc.html).toContain('«Благорост» в сумме 1000.00 RUB')

    const after = (await gql<any>(holderToken, TRANSFER, transferInput(holder, '1000.0000 RUB', signed))).capitalTransferShare
    expect(num(after.blagorost_balance)).toBe(2000)
    expect(await chainBalance(holder.account, 'w.cap.blago')).toBe(2000)
    expect(await chainBalance(holder.account, 'w.wal.share')).toBe(shareBefore + 1000)

    // Одно заявление — одна трансляция: второго списания нет.
    expectCode(await gqlError(holderToken, TRANSFER, transferInput(holder, '1000.0000 RUB', signed)), 'CAPITAL_SHARE_TRANSFER_STATEMENT_USED')
    expect(await chainBalance(holder.account, 'w.cap.blago')).toBe(2000)

    const history = (await gql<any>(holderToken, HISTORY, { f: { username: holder.account } })).capitalShareTransfers
    expect(history.items).toEqual([expect.objectContaining({ username: holder.account, amount: '1000.0000 RUB', statement_hash: String(signed.hash).toLowerCase() })])
    expect(history.items[0].transaction_id).not.toBe('')
  })

  it(caseName('cap.share-transfer.side.02', 'сумма сверх остатка отклоняется до цепи'), async () => {
    const { signed } = await signedStatement(holderToken, holder, '999999.0000 RUB')
    expectCode(await gqlError(holderToken, TRANSFER, transferInput(holder, '999999.0000 RUB', signed)), 'CAPITAL_SHARE_TRANSFER_INSUFFICIENT')
  })

  it(caseName('cap.share-transfer.side.03', 'заявление на другую сумму отклоняется до цепи'), async () => {
    const { signed } = await signedStatement(holderToken, holder, '100.0000 RUB')
    expectCode(await gqlError(holderToken, TRANSFER, transferInput(holder, '200.0000 RUB', signed)), 'KIT_DOCUMENT_FIELD_MISMATCH')
  })

  it(caseName('cap.share-transfer.side.05', 'пайщик с ролью не действует за другого, председатель видит историю всех'), async () => {
    expectCode(await gqlError(holderToken, STATE, { d: { username: CHAIRMAN.account } }), 'KIT_RIGHT_SCOPE_OWN')
    expectCode(await gqlError(holderToken, HISTORY, {}), 'KIT_RIGHT_SCOPE_OWN')
    const all = (await gql<any>(chairman, HISTORY, {})).capitalShareTransfers
    expect(all.items.some((i: any) => i.username === holder.account)).toBe(true)
  })

  it(caseName('cap.share-transfer.happy.02', 'весь остаток транслируется целиком'), async () => {
    const rest = (await gql<any>(holderToken, STATE, { d: { username: holder.account } })).capitalShareTransferState.blagorost_balance
    const { signed } = await signedStatement(holderToken, holder, rest)
    const after = (await gql<any>(holderToken, TRANSFER, transferInput(holder, rest, signed))).capitalTransferShare
    expect(num(after.blagorost_balance)).toBe(0)
    expect(await chainBalance(holder.account, 'w.cap.blago')).toBe(0)
  })

  it(caseName('cap.share-transfer.side.01', 'нулевая сумма отклоняется до цепи'), async () => {
    const who = await memberWithBlagorost('sht', '100.0000 RUB')
    await gql(chairman, ASSIGN, { d: { username: who.account, role: ROLE } })
    const token = await login(who)
    const { signed } = await signedStatement(token, who, '1.0000 RUB')
    expectCode(await gqlError(token, TRANSFER, transferInput(who, '0.0000 RUB', signed)), 'CAPITAL_SHARE_TRANSFER_AMOUNT_INVALID')
  })

  it(caseName('cap.share-transfer.side.07', 'снятая роль закрывает трансляцию сразу'), async () => {
    const who = await memberWithBlagorost('sht', '100.0000 RUB')
    await gql(chairman, ASSIGN, { d: { username: who.account, role: ROLE } })
    const token = await login(who)
    const { signed } = await signedStatement(token, who, '50.0000 RUB')
    await gql(chairman, REVOKE, { d: { username: who.account, role: ROLE } })
    expectCode(await gqlError(token, TRANSFER, transferInput(who, '50.0000 RUB', signed)), 'KIT_INSUFFICIENT_RIGHTS')
    expect(await chainBalance(who.account, 'w.cap.blago')).toBe(100)
  })
})
