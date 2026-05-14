/**
 * Фаза 08 — инвестиции: открывает приём инвестиций на компоненте, проводит
 * два паевых взноса от пайщиков-инвесторов:
 *
 *   1) ivanpetrov → компонент «MVP v1»  (15 000 ₽, прямая аллокация в компонент)
 *   2) ekaterina  → программа «Благорост»  (10 000 ₽, без указания компонента;
 *      совет сам распределит средства)
 *
 * Объёмы намеренно небольшие: при крупных инвестициях active_voting_amount
 * раздувается, и суммарный intellectual_cost после расчёта голосов
 * превосходит пул кошелька «ЦПП Генератор — принятый коммит». Маленькие
 * инвестиции дают пропорции, при которых выкуп РИД (фаза 13) проходит.
 *
 * Перед инвестициями оба пайщика пополняют свои кошельки через
 * wallet::createdeposit + gateway::completeincome.
 *
 * Зависит от фазы 07 (план должен быть установлен — иначе capital::openproject
 * не пропустит). Идемпотентна: openproject пропускается если is_opened=true,
 * deposit/invest всегда создают новые записи (но это не критично для seed).
 */
import path from 'node:path'
import fs from 'node:fs'
import { createHash, randomInt } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { CapitalContract, WalletContract, GatewayContract, SovietContract } from 'cooptypes'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:08]', ...a)

const COOPNAME = 'voskhod'
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

const here = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(here, '../../../../../..')
const STATE_DIR = path.join(REPO_ROOT, 'components/docs-harness/state/participants')

const FAKE_HASH = '157192b276da23cc84ab078fc8755c051c5f0430bf4802e55718221e6b76c777'
function fakeDocumentSignedBy(signer: string) {
  return {
    version: '1.0.0',
    hash: FAKE_HASH,
    doc_hash: FAKE_HASH,
    meta_hash: FAKE_HASH,
    meta: '{}',
    signatures: [{
      id: 1,
      signed_hash: FAKE_HASH,
      signer,
      public_key: 'EOS5JhMfxbsNebajHcTEK8yC9uNN9Dit9hEmzE8ri8yMhhzxrLg3J',
      signature: 'SIG_K1_KmKWPBC8dZGGDGhbKEoZEzPr3h5crRrR2uLdGRF5DJbeibY1MY1bZ9sPwHsgmPfiGFv9psfoCVsXFh9TekcLuvaeuxRKA8',
      signed_at: '2025-05-14T12:22:26',
      meta: '{}',
    }],
  }
}

function rndHash(): string {
  return createHash('sha256').update(`rnd:${Date.now()}:${randomInt(1_000_000_000)}`).digest('hex')
}

interface IFixture { username: string; email: string; wif: string }
function readFixture(username: string): IFixture {
  const file = path.join(STATE_DIR, `${username}.json`)
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<IFixture>
  if (!data.wif || !data.email) throw new Error(`Фикстура ${file} без wif/email`)
  return { username, email: data.email, wif: data.wif }
}

async function depositToWallet(blockchain: Blockchain, username: string, amountRub: number): Promise<void> {
  const depositHash = rndHash()
  const quantity = `${amountRub.toFixed(4)} RUB`
  log(`wallet::createdeposit ${username} ← ${quantity} (deposit=${depositHash.slice(0, 10)}...)`)
  await blockchain.api.transact({
    actions: [{
      account: WalletContract.contractName.production,
      name: WalletContract.Actions.CreateDeposit.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username,
        deposit_hash: depositHash,
        quantity,
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })

  log(`gateway::completeincome ${depositHash.slice(0, 10)}...`)
  await blockchain.api.transact({
    actions: [{
      account: GatewayContract.contractName.production,
      name: GatewayContract.Actions.CompleteIncome.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        income_hash: depositHash,
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function startProjectIfNeeded(blockchain: Blockchain): Promise<void> {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'projects',
    1,
    COMPONENT_HASH,
    COMPONENT_HASH,
    3,
    'sha256',
  ) as Array<{ status?: string }>
  const row = rows[0]
  // startproject допустим только из pending; если уже active/voting/result/finalized — no-op.
  if (row?.status && row.status !== 'pending') {
    log(`компонент в статусе ${row.status} — пропуск capital::startproject`)
    return
  }
  log('capital::startproject — переводим компонент в Active')
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.StartProject.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        project_hash: COMPONENT_HASH,
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function openProjectIfNeeded(blockchain: Blockchain): Promise<void> {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'projects',
    1,
    COMPONENT_HASH,
    COMPONENT_HASH,
    3,
    'sha256',
  ) as Array<{ is_opened?: number }>
  const row = rows[0]
  if (row?.is_opened === 1) {
    log('компонент уже открыт на инвестиции — пропуск capital::openproject')
    return
  }
  log('capital::openproject — компонент готов принимать инвестиции')
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.OpenProject.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        project_hash: COMPONENT_HASH,
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function investInProject(blockchain: Blockchain, investor: IFixture, amountRub: number): Promise<void> {
  const investHash = rndHash()
  const amount = `${amountRub.toFixed(4)} RUB`
  log(`capital::createinvest ${investor.username} → компонент MVP v1 (${amount})`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateProjectInvest.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        project_hash: COMPONENT_HASH,
        username: investor.username,
        invest_hash: investHash,
        amount,
        statement: fakeDocumentSignedBy(investor.username),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function investInProgram(blockchain: Blockchain, investor: IFixture, amountRub: number): Promise<void> {
  const investHash = rndHash()
  const amount = `${amountRub.toFixed(4)} RUB`
  log(`capital::createpinv ${investor.username} → программа «Благорост» (${amount})`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateProgramInvest.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username: investor.username,
        invest_hash: investHash,
        amount,
        statement: fakeDocumentSignedBy(investor.username),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

// Подпись соглашения о ЦПП (wallet/blagorost) от имени самого пайщика —
// soviet::sndagreement требует authorization=username, поэтому в keychain
// blockchain нужны wif'ы инвесторов.
async function signAgreement(
  blockchain: Blockchain,
  username: string,
  agreementType: string,
): Promise<void> {
  log(`soviet::sndagreement ${username} ← '${agreementType}'`)
  await blockchain.api.transact({
    actions: [{
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Agreements.SendAgreement.actionName,
      authorization: [{ actor: username, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        administrator: COOPNAME,
        username,
        agreement_type: agreementType,
        document: fakeDocumentSignedBy(username),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function signAppendixIfNeeded(blockchain: Blockchain, username: string): Promise<void> {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'contributors',
    1,
    username,
    username,
    2,
    'i64',
  ) as Array<{ appendixes?: string[] }>
  if (rows[0]?.appendixes?.includes(COMPONENT_HASH)) {
    log(`${username} уже подписал приложение к компоненту — пропуск`)
    return
  }
  const appendixHash = createHash('sha256').update(`appendix:${username}:${COMPONENT_HASH}:invest`).digest('hex')
  log(`capital::getclearance ${username} → компонент MVP v1`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.GetClearance.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username,
        project_hash: COMPONENT_HASH,
        appendix_hash: appendixHash,
        document: fakeDocumentSignedBy(username),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
  log(`soviet::confirmapprv приложение ${username} (${appendixHash.slice(0, 10)}...)`)
  await blockchain.api.transact({
    actions: [{
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Approves.ConfirmApprove.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username: 'ant',
        approval_hash: appendixHash,
        approved_document: fakeDocumentSignedBy('ant'),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function ensureAgreementsAndWallet(blockchain: Blockchain, fix: IFixture): Promise<void> {
  // Кошелёк по программе wallet (id=1) обязателен для completeincome.
  const walletRows = await blockchain.getTableRows(
    WalletContract.contractName.production,
    COOPNAME,
    'userwallets',
    1,
    fix.username,
    fix.username,
    2,
    'i64',
  ).catch(() => [])
  if (walletRows.length === 0) {
    await signAgreement(blockchain, fix.username, 'wallet')
  } else {
    log(`${fix.username}: wallet-кошелёк уже есть — пропуск signWalletAgreement`)
  }
  // Базовые agreements первого входа — убирают каскад модалок «Прочитайте и
  // подпишите документ» в UI (route.meta.agreements = ['wallet','signature','privacy','user']).
  // Без них любая страница desktop при первом логине показывает 4 диалога.
  for (const aType of ['signature', 'privacy', 'user']) {
    await signAgreement(blockchain, fix.username, aType).catch((e) => {
      log(`signAgreement ${aType} для ${fix.username} — пропуск (${(e as Error).message?.slice(0, 80)})`)
    })
  }
  // Согласие с ЦПП «Благорост» — для инвестиций в программу/компонент.
  // Блокировка идёт по своему пути; для безопасности дёргаем при первом запуске.
  await signAgreement(blockchain, fix.username, 'blagorost').catch((e) => {
    log(`signAgreement blagorost для ${fix.username} — пропуск (${(e as Error).message?.slice(0, 80)})`)
  })
}

export async function phase08(): Promise<void> {
  const petrov = readFixture('ivanpetrov')
  const ekaterina = readFixture('ekaterina')

  // Создаём blockchain с расширенным keychain — ключи всех нужных подписантов
  // (soviet::sndagreement требует подписи самого пайщика).
  const blockchain = new Blockchain(config.network, [
    ...config.private_keys,
    petrov.wif,
    ekaterina.wif,
  ])
  await blockchain.update_pass_instance()

  // Переводим компонент в active (нужно для createinvest) и открываем на приём инвестиций
  await startProjectIfNeeded(blockchain)
  await openProjectIfNeeded(blockchain)

  // Соглашения и кошельки инвесторов
  await ensureAgreementsAndWallet(blockchain, petrov)
  await ensureAgreementsAndWallet(blockchain, ekaterina)

  // Приложения к УХД-договору для инвесторов (нужно для capital::createinvest)
  await signAppendixIfNeeded(blockchain, petrov.username)
  await signAppendixIfNeeded(blockchain, ekaterina.username)

  // Идемпотентность: createinvest/createpinv требуют project.status = active.
  // На повторном прогоне (компонент уже в voting/result) — пропускаем deposit
  // и инвестиции; первая запись инвестиции уже есть в системе.
  const componentRows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'projects',
    1,
    COMPONENT_HASH,
    COMPONENT_HASH,
    3,
    'sha256',
  ) as Array<{ status?: string }>
  if (componentRows[0]?.status !== 'active') {
    log(`компонент в статусе ${componentRows[0]?.status} — пропуск депозитов и инвестиций (фаза 08 уже отработала ранее)`)
    log('фаза 08 завершена')
    return
  }

  // Пополняем кошельки инвесторов через депозит
  await depositToWallet(blockchain, petrov.username, 20_000)
  await depositToWallet(blockchain, ekaterina.username, 15_000)

  // Инвестиции
  await investInProject(blockchain, petrov, 15_000)
  await investInProgram(blockchain, ekaterina, 10_000)

  log('фаза 08 завершена')
}
