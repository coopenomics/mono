/**
 * Фаза 06 — создаёт проект «Кошелёк пайщика» (id=48) и его компонент «MVP v1»
 * (id=49) ончейн через `capital::createproject`.
 *
 * Это «рабочий» проект для серии инструкций по Генерации: на нём документируется
 * полный путь — назначение мастера, план, инвестиции, коммиты, голосование,
 * выход в Благорост. В обычной серии фаза 03 (полный реестр из 12+1 проектов)
 * не подключается — Мастерская содержит только этот проект, чтобы документация
 * не путалась с фоном.
 *
 * Хеши детерминированные (sha256("blago:project:<id>")) — те же что и в фазе 03,
 * так что одновременный запуск 03 и 06 не создаст дублей: оба используют один
 * и тот же hash для id=48 и id=49.
 */
import { CapitalContract } from 'cooptypes'
import Blockchain from '../../../blockchain'
import config from '../../../configs'
import { PROJECTS, ROOT_HASH, projectHash } from '../data/projects'

const log = (...a: unknown[]) => console.error('[seed-capital:06]', ...a)

const COOPNAME = 'voskhod'
const PROJECT_ID = 48
const COMPONENT_ID = 49

async function getProject(blockchain: Blockchain, coopname: string, projectHashHex: string) {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    CapitalContract.Tables.Projects.tableName,
    1000,
    projectHashHex,
    projectHashHex,
    3,
    'sha256',
  )
  return rows[0]
}

export async function phase06(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const targets = PROJECTS.filter((p) => p.id === PROJECT_ID || p.id === COMPONENT_ID)
  if (targets.length !== 2) {
    throw new Error(`data/projects.ts: ожидаются id=${PROJECT_ID} и id=${COMPONENT_ID}, найдено ${targets.length}`)
  }
  // Проект должен идти раньше компонента, иначе capital отклонит компонент
  // с неизвестным parent_hash.
  const sorted = targets.sort((a, b) => (a.parentId === null ? -1 : 1) - (b.parentId === null ? -1 : 1))

  let created = 0
  let skipped = 0
  for (const item of sorted) {
    const hash = projectHash(item.id)
    const parent_hash = item.parentId === null ? ROOT_HASH : projectHash(item.parentId)

    const existing = await getProject(blockchain, COOPNAME, hash)
    if (existing) {
      log(`#${item.id} «${item.title}» уже существует — пропуск`)
      skipped++
      continue
    }

    const data: CapitalContract.Actions.CreateProject.ICreateProject = {
      coopname: COOPNAME,
      project_hash: hash,
      parent_hash,
      title: item.title,
      description: `Кооперативный проект «${item.title}».`,
      invite: '',
      data: JSON.stringify({ summary: item.title }),
      meta: JSON.stringify({ seed_source: 'seed-capital/phase-06', seed_id: item.id, title: item.title }),
    }

    log(`#${item.id} «${item.title}» (parent=${item.parentId ?? 'root'})`)
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

  log(`фаза 06 завершена: создано ${created}, пропущено ${skipped}`)
}
