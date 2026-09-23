import { beforeAll, describe, expect, it } from 'vitest'
import { CapitalContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'
import { generateRandomDescription } from '../utils'
import { chainTextDigest } from '../utils/chainTextDigest'
import { getProject } from './capital/getProject'
import { ensureCapitalConfigured } from './shared/ensureCapitalConfigured'

/**
 * Тексты проектов Благороста в цепи хранятся хешем (C28-78).
 *
 * Описание и приглашение живут в базе контроллера, в строке capital::projects
 * лежит sha256 текста или пустая строка. Память цепи под документ кооператива
 * оплачивает кооператив, и одна «Концепция» с текстом весила 62 КБ.
 */
const blockchain = new Blockchain(config.network, config.private_keys)
const coopname = 'voskhod'
const emptyHash = '0000000000000000000000000000000000000000000000000000000000000000'

async function send(name: string, data: object) {
  return blockchain.api.transact(
    {
      actions: [{
        account: CapitalContract.contractName.production,
        name,
        authorization: [{ actor: coopname, permission: 'active' }],
        data,
      }],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

function projectData(project_hash: string, description: string, invite = ''): CapitalContract.Actions.CreateProject.ICreateProject {
  return {
    coopname,
    project_hash,
    parent_hash: emptyHash,
    title: `Хеш текста ${project_hash.slice(0, 10)}`,
    description,
    invite,
    data: '',
    meta: '',
  }
}

beforeAll(async () => {
  await blockchain.update_pass_instance()
  await ensureCapitalConfigured(blockchain, coopname)
}, 240_000)

describe('тексты проекта в цепи — хешем', () => {
  // Первый релиз выноса (TextDigest::PHASE2 = false в lib/core/text_digest.hpp):
  // раскатка ставит контракты раньше контроллера, и прежний контроллер ещё шлёт
  // текст — контракт его принимает. Во втором релизе PHASE2 = true, и здесь
  // снова ждём отказа: .rejects.toThrow(/sha256/).
  it('createproj в первом релизе принимает и описание текстом — от прежнего контроллера', async () => {
    const project_hash = generateRandomSHA256()
    const description = generateRandomDescription()
    await send(CapitalContract.Actions.CreateProject.actionName, projectData(project_hash, description))

    const row = await getProject(blockchain, coopname, project_hash)
    expect(row.description).toBe(description)
  })

  it('createproj кладёт в строку хеш описания как есть', async () => {
    const project_hash = generateRandomSHA256()
    const description = chainTextDigest(generateRandomDescription())
    await send(CapitalContract.Actions.CreateProject.actionName, projectData(project_hash, description))

    const row = await getProject(blockchain, coopname, project_hash)
    expect(row.description).toBe(description)
    expect(row.invite).toBe('')
  })

  // Первый релиз выноса (TextDigest::PHASE2 = false в lib/core/text_digest.hpp):
  // раскатка ставит контракты раньше контроллера, и прежний контроллер ещё шлёт
  // текст — контракт его принимает. Во втором релизе PHASE2 = true, и здесь
  // снова ждём отказа: .rejects.toThrow(/sha256/).
  it('editproj в первом релизе принимает приглашение и текстом, и хешем', async () => {
    const project_hash = generateRandomSHA256()
    await send(CapitalContract.Actions.CreateProject.actionName, projectData(project_hash, ''))

    const { parent_hash: _parent, ...base } = projectData(project_hash, '')
    const edit: CapitalContract.Actions.EditProject.IEditProject = { ...base, invite: 'Приглашение текстом' }
    await send(CapitalContract.Actions.EditProject.actionName, edit)
    expect((await getProject(blockchain, coopname, project_hash)).invite).toBe('Приглашение текстом')
    await new Promise(resolve => setTimeout(resolve, 600)) // timing: ui — два одинаковых действия подряд цепь приняла бы за повтор

    const invite = chainTextDigest('Приглашение текстом')
    await send(CapitalContract.Actions.EditProject.actionName, { ...edit, invite })
    const row = await getProject(blockchain, coopname, project_hash)
    expect(row.invite).toBe(invite)
  })
})
