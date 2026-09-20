/**
 * Контрактный уровень: импорт пайщика с бумажными договорами
 * (реестр capital.contributor-import, level contract).
 *
 * Старых пайщиков кооператив вводит в электронный учёт как есть: договор УХД и
 * соглашение о присоединении к «Благоросту» подписаны на бумаге, электронной
 * подписи под ними нет. `capital::importcontrib` заводит запись участника и
 * сразу зачисляет его взнос на кошелёк программы, а `ledger2::walletop` перед
 * зачислением на `w.cap.blago` требует программное соглашение в
 * `wallet::users.programs[]` (ADR-004). Поэтому импорт сам фиксирует
 * соглашение через `wallet::importagree` — с нулевым doc_hash и draft_id = 0,
 * что и означает «подписано вне платформы».
 *
 * Проверяется, что импорт проходит без единой электронной подписи, что запись
 * соглашения появляется именно в таком виде и что уже подписанное в платформе
 * соглашение импорт не перетирает.
 *
 * Тест самодостаточен: каждый случай заводит своего пайщика.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CapitalContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { addUser } from '../init/participant'
import { generateRandomSHA256 } from '../utils/randomHash'
import { generateRandomUsername } from '../utils/randomUsername'
import { COOP, getContributor, getUserWallet, minor, programInvest, rub } from './capital/programInvest'
import { depositToWallet } from './wallet/depositToWallet'
import { signCapitalAgreement } from './capital/signCapitalAgreement'
import { fakeDocument } from './shared/fakeDocument'
import { capitalDraftId, capitalProgramId } from './capital/consts'

const bc = new Blockchain(config.network, config.private_keys)

const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000'
const IMPORT_AMOUNT = 12_000 // рублей — сумма взноса по бумажному договору

/** Программное соглашение пайщика из `wallet::users.programs[]`. */
async function getProgramAgreement(username: string, programId: number) {
  const rows = await bc.getTableRows('wallet', COOP, 'users', 1, username, username, 2, 'i64') as any[]
  return rows[0]?.programs?.find((p: any) => Number(p.program_id) === programId)
}

/** Импорт пайщика с бумажными договорами — как его делает стол председателя. */
async function importContributor(username: string, rubles: number) {
  return bc.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.ImportContributor.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: {
        coopname: COOP,
        username,
        contributor_hash: generateRandomSHA256(),
        contribution_amount: rub(rubles),
        memo: 'Импорт пайщика по бумажному договору контрактным тестом',
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

describe('Благорост — импорт пайщика с бумажными договорами (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
  }, 60_000)

  it('cap.cimp.happy.01: импорт без единой электронной подписи заводит участника, соглашение программы и зачисляет взнос', async () => {
    // Пайщик состоит в кооперативе, но оферту «Благороста» в платформе не
    // подписывал: его соглашение — на бумаге. До появления wallet::importagree
    // импорт падал на проверке walletop «не подписано соглашение program_id=4».
    const username = generateRandomUsername()
    await addUser(username)

    expect(await getProgramAgreement(username, capitalProgramId),
      'предусловие ветки: соглашения «Благороста» в платформе у пайщика нет').toBeUndefined()

    await importContributor(username, IMPORT_AMOUNT)

    const contributor = await getContributor(bc, username)
    expect(contributor, 'запись импортированного участника обязана появиться').toBeDefined()

    const agreement = await getProgramAgreement(username, capitalProgramId)
    expect(agreement, 'импорт обязан завести соглашение программы в wallet::users').toBeDefined()
    expect(agreement.doc_hash,
      'электронного документа под бумажным соглашением нет — хэш нулевой').toBe(ZERO_HASH)
    expect(Number(agreement.draft_id),
      'бумага подписана вне сетевого шаблона — draft_id нулевой').toBe(0)
    expect(Number(agreement.version), 'редакции шаблона у бумаги тоже нет').toBe(0)

    const blago = await getUserWallet(bc, username, 'w.cap.blago')
    expect(blago.available,
      'взнос по бумажному договору обязан лечь на кошелёк программы').toBeCloseTo(IMPORT_AMOUNT, 2)
  }, 900_000)

  it('cap.cimp.side.01: импорт пайщика, уже подписавшего оферту в платформе, не перетирает его электронную подпись', async () => {
    const username = generateRandomUsername()
    await addUser(username)
    await signCapitalAgreement(bc, COOP, username, fakeDocument)

    const signed = await getProgramAgreement(username, capitalProgramId)
    expect(signed, 'предусловие ветки: оферта подписана в платформе').toBeDefined()

    await importContributor(username, IMPORT_AMOUNT)

    const afterImport = await getProgramAgreement(username, capitalProgramId)
    expect(afterImport.doc_hash,
      'электронная подпись старше бумаги — хэш документа обязан остаться прежним').toBe(signed.doc_hash)
    expect(Number(afterImport.draft_id),
      'шаблон подписанной оферты обязан остаться прежним').toBe(capitalDraftId)
  }, 900_000)

  it('cap.cimp.side.02: импортированный пайщик работает дальше как обычный — взнос в программу проходит', async () => {
    const username = generateRandomUsername()
    await addUser(username)
    await importContributor(username, IMPORT_AMOUNT)

    const blagoBefore = await getUserWallet(bc, username, 'w.cap.blago')

    // Взнос в программу идёт с паевого кошелька — сначала пополняем его.
    await depositToWallet(bc, COOP, username, 50_000)

    await programInvest(bc, username, minor(10_000))

    const blagoAfter = await getUserWallet(bc, username, 'w.cap.blago')
    expect(blagoAfter.available,
      'соглашение, заведённое импортом, обязано пускать обычные операции программы',
    ).toBeCloseTo(blagoBefore.available + 10_000, 2)
  }, 900_000)
})
