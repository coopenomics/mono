import { beforeAll, describe, expect, it } from 'vitest'
import { CapitalContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { addUser } from '../init/participant'
import { generateRandomUsername } from '../utils/randomUsername'
import { generateRandomSHA256 } from '../utils/randomHash'
import { generateRandomDescription, generateRandomMeta, generateRandomProjectData } from '../utils'
import { registerContributor } from './capital/registerContributor'
import { getRowPayer } from './shared/rowPayer'
import { ensureCapitalConfigured } from './shared/ensureCapitalConfigured'
import { chainTextDigest } from '../utils/chainTextDigest'

/**
 * Плательщик за оперативную память строк (C28-78).
 *
 * Кооператив оплачивает свой бизнес-процесс — документы и их проведение.
 * Служебное хранение — реестры, договоры участия, счётчики — оплачивает
 * контракт-владелец таблицы. До этого правила плательщик определялся тем,
 * какое действие трогало строку последним, и одна и та же сущность оказывалась
 * то на кооперативе, то на контракте, то на человеке.
 */
const blockchain = new Blockchain(config.network, config.private_keys)
const coopname = 'voskhod'
let tester: string

beforeAll(async () => {
  await blockchain.update_pass_instance()
  await ensureCapitalConfigured(blockchain, coopname)
  tester = generateRandomUsername()
  await addUser(tester)
}, 240_000)

describe('плательщик за оперативную память', () => {
  it('аккаунт пайщика в реестре оплачивает регистратор', async () => {
    const payer = await getRowPayer(blockchain, 'registrator', 'registrator', 'accounts', tester)
    expect(payer).toBe('registrator')
  })

  it('пайщика в реестре кооператива оплачивает контракт совета', async () => {
    const payer = await getRowPayer(blockchain, 'soviet', coopname, 'participants', tester)
    expect(payer).toBe('soviet')
  })

  it('проект Благороста, заведённый кооперативом, оплачивает кооператив', async () => {
    const project_hash = generateRandomSHA256()
    const data: CapitalContract.Actions.CreateProject.ICreateProject = {
      coopname,
      project_hash,
      parent_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      title: `Проверка плательщика ${project_hash.slice(0, 10)}`,
      description: chainTextDigest(generateRandomDescription()),
      invite: '',
      data: generateRandomProjectData(100, 200),
      meta: generateRandomMeta(),
    }

    const result = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.CreateProject.actionName,
            authorization: [{ actor: coopname, permission: 'active' }],
            data,
          },
        ],
      },
      { blocksBehind: 3, expireSeconds: 30 },
    )
    expect(result.transaction_id).toBeDefined()

    const payer = await getRowPayer(blockchain, CapitalContract.contractName.production, coopname, 'projects', project_hash, 3, 'sha256')
    expect(payer).toBe(coopname)
  })

  it('договор участия в Благоросте оплачивает контракт, даже когда его принимает совет', async () => {
    // Договор проходит одобрение советом: запись меняется колбэком, который
    // кооператив не подписывает. Такой вызов не должен падать отказом цепи.
    await registerContributor(blockchain, coopname, tester, generateRandomSHA256(), '1000.0000 RUB')

    const payer = await getRowPayer(blockchain, CapitalContract.contractName.production, coopname, 'contributors', tester, 2)
    expect(payer).toBe(CapitalContract.contractName.production)
  })
})
