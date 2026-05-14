/**
 * Фаза 03 — мета-проекты и компоненты из `_blago/INDEX.md`.
 *
 * Создаёт ровно ту структуру, что и в продакшен-индексе: 12 мета-проектов
 * (parent_hash = ROOT_HASH) и 30 компонентов (parent_hash = sha256 родителя).
 * Хеши детерминированные — повторный прогон без reboot даёт идентичные сущности
 * и идентичные скриншоты.
 *
 * Зависит от phase-01: программы УХД/Благорост и `capital.state`
 * должны быть инициализированы.
 */
import { CapitalContract } from 'cooptypes'
import Blockchain from '../../../blockchain'
import config from '../../../configs'
import { PROJECTS, ROOT_HASH, projectHash } from '../data/projects'

const log = (...a: unknown[]) => console.error('[seed-capital:03]', ...a)

const COOPNAME = 'voskhod'

// Локальный аналог tests/capital/getProject.ts — оригинал тащит модули с
// `import { expect } from 'vitest'`, а seed запускается под esno.
async function getProject(blockchain: Blockchain, coopname: string, projectHash: string) {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    CapitalContract.Tables.Projects.tableName,
    1000,
    projectHash,
    projectHash,
    3,
    'sha256',
  )
  return rows[0]
}

function makeDescription(title: string): string {
  return `Демонстрационный проект «${title}» для документации Благороста.`
}

function makeMeta(id: number, title: string): string {
  return JSON.stringify({
    seed_source: '_blago/INDEX.md',
    seed_id: id,
    title,
  })
}

function makeData(title: string): string {
  return JSON.stringify({
    summary: `Структурный элемент демонстрационного списка проектов: ${title}.`,
  })
}

export async function phase03(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  // Мета должны создаваться раньше своих компонентов — иначе CAPITAL отвергнет
  // компонент с неизвестным parent_hash.
  const sorted = [...PROJECTS].sort((a, b) => {
    if (a.parentId === null && b.parentId !== null) return -1
    if (a.parentId !== null && b.parentId === null) return 1
    return a.id - b.id
  })

  let created = 0
  let skipped = 0

  for (const project of sorted) {
    const hash = projectHash(project.id)
    const parent_hash = project.parentId === null ? ROOT_HASH : projectHash(project.parentId)

    const existing = await getProject(blockchain, COOPNAME, hash)
    if (existing) {
      skipped++
      continue
    }

    const data: CapitalContract.Actions.CreateProject.ICreateProject = {
      coopname: COOPNAME,
      project_hash: hash,
      parent_hash,
      title: project.title,
      description: makeDescription(project.title),
      invite: '',
      data: makeData(project.title),
      meta: makeMeta(project.id, project.title),
    }

    log(`#${project.id} «${project.title}» (parent=${project.parentId ?? 'root'})`)
    await blockchain.api.transact({
      actions: [{
        account: CapitalContract.contractName.production,
        name: CapitalContract.Actions.CreateProject.actionName,
        authorization: [{ actor: COOPNAME, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
    created++
  }

  log(`фаза 03 завершена: создано ${created}, пропущено ${skipped} (всего в seed: ${PROJECTS.length})`)
}
