/**
 * Фаза 10 — коммиты + приёмка мастером + перевод компонента в голосование.
 *
 * Сценарий:
 *   1) ivanpetrov коммитит 8 ч на компонент «MVP v1» (capital::createcmmt).
 *   2) ekaterina   коммитит 6 ч на тот же компонент.
 *   3) ant (мастер) принимает оба коммита (capital::approvecmmt) — часы
 *      становятся подтверждёнными, попадают в Кошелёк Генерации исполнителя.
 *   4) ant (мастер) переводит компонент в статус VOTING (capital::startvoting).
 *
 * После фазы:
 *   - страница «Голосование по компоненту» доступна;
 *   - participants компонента (ivanpetrov, ekaterina, ant — те у кого has_vote=true)
 *     могут проголосовать.
 *
 * Фаза НЕ голосует — это работа сценария blagorost/voting.mjs (UI-документация).
 *
 * Идемпотентно: смотрит project.status и project.counts.total_commits;
 * если уже VOTING — фаза no-op; если ACTIVE и часть коммитов уже принята —
 * пропускает по contributor.contributed_hours.
 */
import { CapitalContract } from 'cooptypes'
import { createHash } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:10]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

interface IProjectRow {
  status?: string
  master?: string
  counts?: { total_commits?: number }
}

interface IContributorRow {
  username?: string
  contributed_hours?: number | string
}

async function getProject(blockchain: Blockchain): Promise<IProjectRow | undefined> {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'projects',
    1,
    COMPONENT_HASH,
    COMPONENT_HASH,
    3,
    'sha256',
  )
  return rows[0]
}

async function getContributedHours(blockchain: Blockchain, username: string): Promise<number> {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'segments',
    100,
    COMPONENT_HASH,
    COMPONENT_HASH,
    2,
    'sha256',
  ) as Array<{ username?: string, fact?: { creator_hours?: number | string } }>
  const seg = rows.find((r) => r.username === username)
  if (!seg) return 0
  const v = seg.fact?.creator_hours ?? 0
  return typeof v === 'string' ? parseInt(v, 10) || 0 : Number(v) || 0
}

function commitHashFor(username: string): string {
  return createHash('sha256').update(`commit:${username}:mvp-v1`).digest('hex')
}

async function commitAndApprove(
  blockchain: Blockchain,
  username: string,
  hours: number,
): Promise<void> {
  const already = await getContributedHours(blockchain, username)
  if (already >= hours) {
    log(`${username}: уже зачтено ${already}ч (>= ${hours}ч) — пропуск`)
    return
  }

  const commitHash = commitHashFor(username)
  log(`capital::createcmmt ${username} → ${hours}ч (commit_hash=${commitHash.slice(0, 12)}...)`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateCommit.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username,
        project_hash: COMPONENT_HASH,
        commit_hash: commitHash,
        creator_hours: hours,
        description: `Seed-коммит ${username} (${hours}ч) для документации`,
        meta: JSON.stringify({ seed: true, hours }),
      } as CapitalContract.Actions.CreateCommit.ICommit,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })

  log(`capital::approvecmmt ${CHAIRMAN} → коммит ${username}`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CommitApprove.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        master: CHAIRMAN,
        commit_hash: commitHash,
      } as CapitalContract.Actions.CommitApprove.ICommitApprove,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

export async function phase10(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const project = await getProject(blockchain)
  if (!project) throw new Error(`компонент MVP v1 (${COMPONENT_HASH.slice(0, 12)}...) не найден`)
  log(`статус компонента: ${project.status}, total_commits=${project.counts?.total_commits ?? 0}`)

  if (project.status === 'voting' || project.status === 'result' || project.status === 'finalized') {
    log(`компонент уже в статусе ${project.status} — фаза no-op`)
    return
  }
  if (project.status !== 'active') {
    throw new Error(`компонент в статусе ${project.status}; ожидался active (нужен phase 08 — startproject + openproject)`)
  }

  // 1+2+3: коммиты от исполнителей + приёмка мастером.
  // Часы выбраны достаточными, чтобы пул кошелька «ЦПП Генератор — принятый
  // коммит» (≈ часы × hour_cost) покрывал последующий выкуп РИД (фаза 13).
  await commitAndApprove(blockchain, 'ivanpetrov', 30)
  await commitAndApprove(blockchain, 'ekaterina', 20)

  // 4: перевод в голосование (capital::startvoting).
  log(`capital::startvoting → компонент MVP v1`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.StartVoting.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        project_hash: COMPONENT_HASH,
      } as CapitalContract.Actions.StartVoting.IStartVoting,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })

  log('фаза 10 завершена — компонент переведён в голосование')
}
