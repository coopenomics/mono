/* eslint-disable no-console */
/**
 * Ручная проба A3D-2: контракты подписи пишут утверждённую кооперативом редакцию.
 *
 * Поднимает редакцию шаблонов 1 (кошелёк) и 3 (политика) в сети, оставляя
 * утверждение кооператива на прежней редакции, подписывает документы новым
 * пайщиком и проверяет, что в подпись легла утверждённая редакция, а после
 * утверждения новой — новая. После прогона оба шаблона остаются утверждёнными
 * на текущей редакции сети.
 *
 * Запуск: pnpm --filter @coopenomics/boot exec esno src/tests/adjust/probe-effective-version.ts
 */
import Blockchain from '../../blockchain'
import config from '../../configs'
import { addUser } from '../../init/participant'
import { signProgramAgreement } from '../../init/sign-program-agreement'
import { generateRandomSHA256 } from '../../utils/randomHash'
import { generateRandomUsername } from '../../utils/randomUsername'
import { fakeDocument } from '../shared/fakeDocument'
import { sleep } from '../../utils'

const COOP = 'voskhod'
const PRIVACY = { registry_id: 3, type: 'privacy' }
const WALLET = { registry_id: 1, program_id: 1 }

const blockchain = new Blockchain(config.network, config.private_keys)
let failed = false

function check(ok: boolean, label: string) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok)
    failed = true
}

async function approvalRow(registry_id: number): Promise<any | undefined> {
  const [row] = await blockchain.getTableRows('draft', COOP, 'approvals', 1, String(registry_id), String(registry_id))
  return row
}

async function draftVersion(registry_id: number): Promise<number> {
  const [row] = await blockchain.getTableRows('draft', 'draft', 'drafts', 1, String(registry_id), String(registry_id))
  return Number(row.version)
}

async function approve(registry_id: number, version: number, decision_id: number) {
  return blockchain.api.transact({
    actions: [{
      account: 'draft',
      name: 'approve',
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, username: COOP, registry_id, version, decision_id, approved_at: '2026-09-16T00:00:00', text_hash: generateRandomSHA256() },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function upversion(registry_id: number) {
  return blockchain.api.transact({
    actions: [{
      account: 'draft',
      name: 'upversion',
      authorization: [{ actor: 'eosio', permission: 'active' }],
      data: { scope: 'draft', username: 'eosio', registry_id },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function sendPrivacy(username: string) {
  return blockchain.api.transact({
    actions: [{
      account: 'soviet',
      name: 'sndagreement',
      authorization: [{ actor: COOP, permission: 'active' }],
      data: { coopname: COOP, administrator: COOP, username, agreement_type: PRIVACY.type, document: fakeDocument },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function privacySignatureVersion(username: string): Promise<number | undefined> {
  const rows = await blockchain.getTableRows('soviet', COOP, 'agreements3', 100)
  const row = rows.find((r: any) => r.username === username && Number(r.draft_id) === PRIVACY.registry_id)
  return row ? Number(row.version) : undefined
}

async function walletSignatureVersion(username: string): Promise<number | undefined> {
  const [user] = await blockchain.getTableRows('wallet', COOP, 'users', 1, username, username)
  const program = user?.programs?.find((p: any) => Number(p.program_id) === WALLET.program_id)
  return program ? Number(program.version) : undefined
}

async function main() {
  await blockchain.update_pass_instance()

  // Расхождение «утверждено меньше, чем в сети» создаём один раз: при повторном
  // прогоне оно уже есть, и редакцию в сети второй раз не поднимаем.
  async function ensureDivergence(registry_id: number, decision_id: number): Promise<{ approved: number, current: number }> {
    const current = await draftVersion(registry_id)
    const approval = await approvalRow(registry_id)
    if (approval && Number(approval.version) < current)
      return { approved: Number(approval.version), current }
    await approve(registry_id, current, decision_id)
    await upversion(registry_id)
    return { approved: current, current: current + 1 }
  }

  const wallet = await ensureDivergence(WALLET.registry_id, 801)
  const privacy = await ensureDivergence(PRIVACY.registry_id, 779)
  console.log(`кошелёк: утверждена ${wallet.approved}, в сети ${wallet.current}; политика: утверждена ${privacy.approved}, в сети ${privacy.current}`)

  const username = generateRandomUsername()
  await addUser(username) // регистрация сама подписывает соглашение кошелька через signagree
  console.log(`новый пайщик ${username}`)

  check(await walletSignatureVersion(username) === wallet.approved, `signagree при регистрации: в подпись легла утверждённая редакция ${wallet.approved}, а не ${wallet.current}`)
  await sendPrivacy(username)
  check(await privacySignatureVersion(username) === privacy.approved, `sndagreement: в подпись легла утверждённая редакция ${privacy.approved}, а не ${privacy.current}`)

  // Совет утвердил новые редакции — переподпись пишет их.
  await approve(WALLET.registry_id, wallet.current, 802)
  await approve(PRIVACY.registry_id, privacy.current, 780)
  await sleep(1500)
  await sendPrivacy(username)
  check(await privacySignatureVersion(username) === privacy.current, `sndagreement после утверждения: редакция ${privacy.current}`)
  await signProgramAgreement(blockchain, COOP, username, WALLET.program_id, WALLET.registry_id, fakeDocument)
  check(await walletSignatureVersion(username) === wallet.current, `signagree после утверждения: редакция ${wallet.current}`)

  if (failed)
    process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
