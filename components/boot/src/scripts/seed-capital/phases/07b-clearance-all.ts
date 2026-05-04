/**
 * Фаза 07b — массовый автодопуск.
 *
 * Подписывает приложение к УХД (`getclearance` + `confirmapprv`) от лица
 * каждого пайщика-участника к Проекту-48 и Компоненту-49. После этой фазы
 * у всех трёх контрибьюторов (ant / ivanpetrov / ekaterina) подтверждён
 * допуск к обоим — пайщик считается «участником», `permissions.has_clearance`
 * на UI становится true, FAB на странице раскрывает действия (создать
 * артефакт, задачу и т.д.), голос фактически уходит в blockchain.
 *
 * Идемпотентно: signAppendixIfNeeded проверяет contributor.appendixes и
 * пропускает, если допуск уже есть.
 *
 * Зависит от фазы 07 (создан мастер + план; УХД-договоры всех пайщиков
 * `active`).
 */
import { CapitalContract, SovietContract } from 'cooptypes'
import { createHash } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:07b]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'

const PROJECT_HASH = createHash('sha256').update('blago:project:48').digest('hex')
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

// Все контрибьюторы, которым нужен допуск к проекту и компоненту.
const PARTICIPANTS = ['ant', 'ivanpetrov', 'ekaterina'] as const

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

interface IContributorRow {
  username?: string
  status?: string
  appendixes?: string[]
}

function makeAppendixHash(username: string, projectHash: string, tag: string): string {
  return createHash('sha256').update(`appendix:${username}:${projectHash}:${tag}`).digest('hex')
}

async function signAppendixIfNeeded(
  blockchain: Blockchain,
  username: string,
  projectHash: string,
  tag: string,
): Promise<void> {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'contributors',
    1,
    username,
    username,
    2,
    'i64',
  ) as IContributorRow[]
  const row = rows[0]
  if (!row) throw new Error(`Contributor ${username} не найден`)
  if (row.appendixes?.map((h) => h.toLowerCase()).includes(projectHash.toLowerCase())) {
    log(`${username} → ${projectHash.slice(0, 10)}... уже есть допуск, пропуск`)
    return
  }

  const appendixHash = makeAppendixHash(username, projectHash, tag)
  log(`capital::getclearance ${username} → ${projectHash.slice(0, 10)}...`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.GetClearance.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username,
        project_hash: projectHash,
        appendix_hash: appendixHash,
        document: fakeDocumentSignedBy(username),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })

  // SHIP эмиттит дельту contract_row как net state change между блоками:
  // если строка вставлена и удалена внутри ОДНОГО блока — дельты не будет.
  // apprvappndx сразу же стирает appendix через delete_appendix(); если он
  // попадёт в тот же блок что и getclearance — parser не увидит ни insert,
  // ни delete, и UI/seed-await будут считать что допуск не получен.
  //
  // Эмпирически 700ms (1×block) не хватало: ~1 раз из 6 строка в
  // capital_appendixes теряется, мастер на UI видит «Принять участие» вместо
  // действий. 1500ms (≥3×block) разносит actions гарантированно.
  // См. memory project_parser_loses_appendix_deltas.md.
  await new Promise((resolve) => setTimeout(resolve, 1500))

  log(`soviet::confirmapprv приложение ${username} (${appendixHash.slice(0, 10)}...)`)
  await blockchain.api.transact({
    actions: [{
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Approves.ConfirmApprove.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username: CHAIRMAN,
        approval_hash: appendixHash,
        approved_document: fakeDocumentSignedBy(CHAIRMAN),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

export async function phase07b(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  // Подписываем приложения для всех пайщиков к обоим хешам — проекту и компоненту.
  for (const username of PARTICIPANTS) {
    for (const [hash, tag] of [[PROJECT_HASH, 'project-48'], [COMPONENT_HASH, 'mvp-v1']] as const) {
      await signAppendixIfNeeded(blockchain, username, hash, tag)
    }
  }

  // Дельты `capital::appendixes` индексируются parser'ом с заметной задержкой
  // (race с action `apprvappndx`). UI считает has_clearance по этой таблице,
  // поэтому без полной индексации последующие сценарии будут видеть FAB
  // «Принять участие» вместо рабочих действий. Ждём пока все 6 строк появятся
  // в БД (3 пайщика × 2 hash) — но не дольше 90s.
  const expected = PARTICIPANTS.length * 2 // 3 × 2 = 6
  log(`жду индексации ${expected} appendix'ов в capital_appendixes...`)
  const pg = new (await import('pg')).Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: COOPNAME,
  })
  await pg.connect()
  try {
    const deadline = Date.now() + 90_000
    let lastCount = 0
    while (Date.now() < deadline) {
      const r = await pg.query(
        `SELECT count(*)::int AS c FROM capital_appendixes WHERE status = 'confirmed'`,
      )
      const c = r.rows[0]?.c ?? 0
      if (c !== lastCount) {
        log(`capital_appendixes confirmed: ${c}/${expected}`)
        lastCount = c
      }
      if (c >= expected) break
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    if (lastCount < expected) {
      log(`предупреждение: только ${lastCount}/${expected} appendix'ов проиндексированы за 90s`)
    }
  } finally {
    await pg.end()
  }

  log('фаза 07b завершена')
}
