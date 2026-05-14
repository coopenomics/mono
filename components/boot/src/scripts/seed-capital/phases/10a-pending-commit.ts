/**
 * Фаза 10a — pending-коммит для документации мастера.
 *
 * Создаёт ОДИН коммит ivanpetrov на компоненте «MVP v1» через
 * `capital::createcmmt` БЕЗ приёмки мастером. Сегмент остаётся в pending,
 * у мастера на странице «Коммиты» появляется неутверждённый коммит — это
 * целевое состояние для скриншотов flow приёмки.
 *
 * Идемпотентно: если у ivanpetrov уже есть pending-коммит (по нашему
 * детерминированному `commit_hash`), фаза no-op.
 *
 * Зависит от 07/07b/09: компонент со статусом active, у пайщика есть допуск
 * и хотя бы одна задача DONE с estimate=8 ч.
 */
import { CapitalContract } from 'cooptypes'
import { createHash } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:10a]', ...a)

const COOPNAME = 'voskhod'
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

interface IProjectRow {
  status?: string
  master?: string
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

interface ICommitRow {
  commit_hash?: string
  status?: string
}

async function findPendingCommit(blockchain: Blockchain, hash: string): Promise<ICommitRow | undefined> {
  // Таблица commits — scope = coopname (см. commit_index в commits.hpp).
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'commits',
    100,
  ) as ICommitRow[]
  return rows.find((r) => (r.commit_hash ?? '').toUpperCase() === hash.toUpperCase())
}

export async function phase10a(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const project = await getProject(blockchain)
  if (!project) throw new Error(`компонент MVP v1 не найден`)
  if (project.status !== 'active') {
    log(`компонент в статусе ${project.status} — фаза no-op (нужен active)`)
    return
  }

  const username = 'ivanpetrov'
  const hours = 8
  const commitHash = createHash('sha256').update(`commit:pending:${username}:mvp-v1`).digest('hex')

  const existing = await findPendingCommit(blockchain, commitHash)
  if (existing) {
    log(`pending-коммит ${username} (${commitHash.slice(0, 12)}...) уже есть, status=${existing.status} — пропуск`)
    return
  }

  log(`capital::createcmmt ${username} → ${hours}ч (commit_hash=${commitHash.slice(0, 12)}...) БЕЗ approve`)
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
        description: `Pending seed-коммит ${username} (${hours} ч) для скриншотов мастера`,
        meta: JSON.stringify({ seed: true, hours, pending: true }),
      } as CapitalContract.Actions.CreateCommit.ICommit,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })

  log('фаза 10a завершена')
}
