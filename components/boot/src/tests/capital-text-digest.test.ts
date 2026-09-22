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
  it('createproj отклоняет описание текстом', async () => {
    const project_hash = generateRandomSHA256()
    await expect(send(CapitalContract.Actions.CreateProject.actionName, projectData(project_hash, generateRandomDescription())))
      .rejects
      .toThrow(/sha256/)
  })

  it('createproj кладёт в строку хеш описания как есть', async () => {
    const project_hash = generateRandomSHA256()
    const description = chainTextDigest(generateRandomDescription())
    await send(CapitalContract.Actions.CreateProject.actionName, projectData(project_hash, description))

    const row = await getProject(blockchain, coopname, project_hash)
    expect(row.description).toBe(description)
    expect(row.invite).toBe('')
  })

  it('editproj отклоняет приглашение текстом и принимает хеш', async () => {
    const project_hash = generateRandomSHA256()
    await send(CapitalContract.Actions.CreateProject.actionName, projectData(project_hash, ''))

    const { parent_hash: _parent, ...base } = projectData(project_hash, '')
    const edit: CapitalContract.Actions.EditProject.IEditProject = { ...base, invite: 'Приглашение текстом' }
    await expect(send(CapitalContract.Actions.EditProject.actionName, edit)).rejects.toThrow(/sha256/)

    const invite = chainTextDigest('Приглашение текстом')
    await send(CapitalContract.Actions.EditProject.actionName, { ...edit, invite })
    const row = await getProject(blockchain, coopname, project_hash)
    expect(row.invite).toBe(invite)
  })
})
