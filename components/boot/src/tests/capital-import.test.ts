import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CapitalContract, SovietContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { getTotalRamUsage, globalRamStats } from '../utils/getTotalRamUsage'
import { addUser, addUser2 } from '../init/participant'
import { generateRandomUsername } from '../utils/randomUsername'
import { generateRandomSHA256 } from '../utils/randomHash'
import { sleep } from '../utils'
import { CooperativeClass } from '../init/cooperative'
import { getCirculationAccount, getCoopProgramWallet, getLedgerAccountById, getUserProgramWalletAmount } from './wallet/walletUtils'
import { registerContributor } from './capital/registerContributor'
import { signAppendix } from './capital/signAppendix'
import { capitalProgramId, circulationAccountId, sourceProgramId } from './capital/consts'
import { commitToResult } from './capital/commitToResult'
import { refreshSegment } from './capital/refreshSegment'
import { signWalletAgreement } from './wallet/signWalletAgreement'
import { fakeDocument } from './shared/fakeDocument'
import { depositToWallet } from './wallet/depositToWallet'
import { signCapitalAgreement } from './capital/signCapitalAgreement'
import { addAuthor } from './capital/addAuthor'
import { getSegment } from './capital/getSegment'
import { investInProject } from './capital/investInProject'
import { processDebt } from './capital/processDebt'
import { processCreateProjectProperty } from './capital/processCreateProjectProperty'
import { processCreateProgramProperty } from './capital/processCreateProgramProperty'
import { processStartVoting } from './capital/processStartVoting'
import { createVoteDistribution, submitVote } from './capital/submitVote'
import { processCompleteVoting } from './capital/processCompleteVoting'
import { processPushResult } from './capital/processPushResult'
import { processConvertSegment } from './capital/processConvertSegment'
import { processCalculateVotes } from './capital/processCalculateVotes'
import { processAddContributor } from './capital/processAddContributor'
import { processDeleteProject } from './capital/processDeleteProject'
import { getProject } from './capital/getProject'
import { processFundProgram } from './capital/processFundProgram'
import { processRefreshProg } from './capital/processRefreshProg'
import { processFundProject } from './capital/processFundProject'
import { processRefreshProj } from './capital/processRefreshProj'
// const CLI_PATH = 'src/index.ts'

const blockchain = new Blockchain(config.network, config.private_keys)
let metaProject: CapitalContract.Actions.CreateProject.ICreateProject
let componentProject: CapitalContract.Actions.CreateProject.ICreateProject
let newComponentProject: CapitalContract.Actions.CreateProject.ICreateProject
let testCoop: string
let chairman: string

let tester1: string
let tester2: string
let tester3: string
let tester4: string
let tester5: string

let investor1: string
let investor2: string
let investor3: string
// let result1: CapitalContract.Actions.CreateResult.ICreateResult
// let result2: CapitalContract.Actions.CreateResult.ICreateResult
// let result3: CapitalContract.Actions.CreateResult.ICreateResult

const commits: string[] = []
const tester1CommitHours = 10
const tester2CommitHours = 20
const tester3CommitHours = 100
const investAmount1 = 100000
const investAmount2 = 25000
const investAmount3 = 25000

const totalToCapitalConvertAmount = 0
const totalToProjectConvertAmount = 0
// Хранение хэшей долгов для каждого пользователя
let userDebtHashes: { [username: string]: string[] } = {}
beforeAll(async () => {
  testCoop = generateRandomUsername()
  chairman = generateRandomUsername()

  await blockchain.update_pass_instance()

  const coop = new CooperativeClass(blockchain)

  await coop.createCooperative(testCoop, {
    privateKey: process.env.EOSIO_PRV_KEY!,
    publicKey: process.env.EOSIO_PUB_KEY!,
  })

  await blockchain.preInit({
    coopname: testCoop,
    username: config.provider,
    status: 'active',
  })

  await addUser2(testCoop, chairman)

  await blockchain.createBoard({
    coopname: testCoop,
    username: testCoop,
    type: 'soviet',
    members: [{
      username: chairman,
      is_voting: true,
      position_title: 'Председатель совета',
      position: 'chairman',
    }],
    name: 'Совет',
    description: '',
  })

  console.log('testcoop: ', testCoop)

  investor1 = generateRandomUsername()
  console.log('investor1: ', investor1)
  await addUser2(testCoop, investor1)

  tester1 = generateRandomUsername()
  console.log('tester1: ', tester1)
  await addUser2(testCoop, tester1)

  tester2 = generateRandomUsername()
  console.log('tester2: ', tester2)
  await addUser2(testCoop, tester2)

  tester3 = generateRandomUsername()
  console.log('tester3: ', tester3)
  await addUser2(testCoop, tester3)

  tester4 = generateRandomUsername()
  console.log('tester4: ', tester4)
  await addUser2(testCoop, tester4)

  tester5 = generateRandomUsername()
  console.log('tester5: ', tester5)
  await addUser2(testCoop, tester5)

  // Инициализируем массивы хэшей долгов для каждого пользователя
  userDebtHashes = {
    [tester1]: [],
    [tester2]: [],
    [tester3]: [],
    [tester4]: [],
    [tester5]: [],
    [investor1]: [],
    [investor2]: [],
    [investor3]: [],
  }

  investor2 = generateRandomUsername()
  console.log('investor2: ', investor2)
  await addUser2(testCoop, investor2, tester4)

  investor3 = generateRandomUsername()
  console.log('investor3: ', investor3)
  await addUser2(testCoop, investor3, tester5)

  // const { stdout } = await execa('esno', [CLI_PATH, 'boot'], { stdio: 'inherit' })
  // expect(stdout).toContain('Boot process completed')
}, 500_000)

afterAll(() => {
  console.log('\n📊 **RAM USAGE SUMMARY** 📊')
  let totalGlobalRam = 0

  for (const [key, ramUsed] of Object.entries(globalRamStats)) {
    const ramKb = (ramUsed / 1024).toFixed(2)
    console.log(`  ${key} = ${ramKb} kb`)
    totalGlobalRam += ramUsed
  }

  console.log(`\n💾 **TOTAL RAM USED IN TESTS**: ${(totalGlobalRam / 1024).toFixed(2)} kb\n`)

  console.log(`testCoop: ${testCoop}\ntester1: ${tester1}\ntester2: ${tester2}\ntester3: ${tester3}\ntester4: ${tester4}\ntester5: ${tester5}\ninvestor1: ${investor1}\ninvestor2: ${investor2}\ninvestor3: ${investor3}`)
})

describe('тест контракта CAPITAL', () => {
  it('создаём программу генерации', async () => {
    const program = await getCoopProgramWallet(blockchain, testCoop, sourceProgramId)
    if (!program) {
      const data: SovietContract.Actions.Programs.CreateProgram.ICreateProgram = {
        coopname: testCoop,
        is_can_coop_spend_share_contributions: true,
        username: chairman,
        title: 'Договор УХД',
        announce: '',
        description: '',
        preview: '',
        images: '',
        calculation_type: 'free',
        fixed_membership_contribution: '0.0000 RUB',
        membership_percent_fee: '0',
        meta: '',
        type: 'generator',
      }

      const result = await blockchain.api.transact(
        {
          actions: [
            {
              account: SovietContract.contractName.production,
              name: SovietContract.Actions.Programs.CreateProgram.actionName,
              authorization: [
                {
                  actor: chairman,
                  permission: 'active',
                },
              ],
              data,
            },
          ],
        },
        {
          blocksBehind: 3,
          expireSeconds: 30,
        },
      )
      getTotalRamUsage(result)
      expect(result.transaction_id).toBeDefined()
    }
  })

  it('создаём программу благороста', async () => {
    const program = await getCoopProgramWallet(blockchain, testCoop, capitalProgramId)

    if (!program) {
      const data: SovietContract.Actions.Programs.CreateProgram.ICreateProgram = {
        coopname: testCoop,
        is_can_coop_spend_share_contributions: false,
        username: chairman,
        title: 'Капитализация',
        announce: '',
        description: '',
        preview: '',
        images: '',
        calculation_type: 'free',
        fixed_membership_contribution: '0.0000 RUB',
        membership_percent_fee: '0',
        meta: '',
        type: 'blagorost',
      }

      const result = await blockchain.api.transact(
        {
          actions: [
            {
              account: SovietContract.contractName.production,
              name: SovietContract.Actions.Programs.CreateProgram.actionName,
              authorization: [
                {
                  actor: chairman,
                  permission: 'active',
                },
              ],
              data,
            },
          ],
        },
        {
          blocksBehind: 3,
          expireSeconds: 30,
        },
      )
      getTotalRamUsage(result)
      expect(result.transaction_id).toBeDefined()
    }
  })

  it('импорт вкладчика ДО установки конфига - должен работать', async () => {
    // Создаем тестового пользователя для импорта
    const importUsername = generateRandomUsername()
    console.log('importUsername: ', importUsername)
    await addUser2(testCoop, importUsername)

    const contributorHash = generateRandomSHA256()
    const contributionAmount = '10000.0000 RUB'

    // Получаем состояние паевого счета ДО импорта
    const shareFundBefore = await getCirculationAccount(blockchain, testCoop)
    const shareFundBalanceBefore = parseFloat(shareFundBefore.available)

    console.log('Share fund before import:', shareFundBalanceBefore)

    // Импортируем вкладчика
    const importData: CapitalContract.Actions.ImportContributor.IImportContributor = {
      coopname: testCoop,
      username: importUsername,
      contributor_hash: contributorHash,
      contribution_amount: contributionAmount,
      memo: 'договор №123 от такого то числа',
    }

    const result = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.ImportContributor.actionName,
            authorization: [
              {
                actor: testCoop,
                permission: 'active',
              },
            ],
            data: importData,
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )
    getTotalRamUsage(result)
    expect(result.transaction_id).toBeDefined()

    // Проверяем, что вкладчик был создан
    const contributorTable = await blockchain.getTableRows(
      CapitalContract.contractName.production,
      testCoop,
      'contributors',
    )
    console.log('contributorTable: ', contributorTable)

    expect(contributorTable.length).toBe(1)
    const contributor = contributorTable[0]
    expect(contributor.username).toBe(importUsername)
    // ImportContributor создаёт запись со статусом IMPORT (см.
    // capital/domain/entities/contributors.hpp Status::IMPORT). Перевод в
    // ACTIVE — отдельным шагом (confirmreg/registerContributor); этот тест
    // проверяет только сам факт импорта.
    expect(contributor.status).toBe('import')

    // Проверяем, что кошелек программы был создан
    const wallet = await getUserProgramWalletAmount(blockchain, testCoop, importUsername, capitalProgramId)
    expect(parseFloat(wallet)).toBe(parseFloat(contributionAmount))

    // Проверяем увеличение паевого счета
    const shareFundAfter = await getCirculationAccount(blockchain, testCoop)
    const shareFundBalanceAfter = parseFloat(shareFundAfter.available)
    console.log('Share fund after import:', shareFundBalanceAfter)

    expect(shareFundBalanceAfter).toBe(shareFundBalanceBefore + parseFloat(contributionAmount))
  })

  it('инициализируем контракт CAPITAL и сверяем конфиг', async () => {
    const data: CapitalContract.Actions.SetConfig.ISetConfig = {
      coopname: testCoop,
      config: {
        coordinator_bonus_percent: 4,
        expense_pool_percent: 100,
        coordinator_invite_validity_days: 30,
        voting_period_in_days: 7,
        authors_voting_percent: 38.2,
        creators_voting_percent: 38.2,
        energy_decay_rate_per_day: 0.11,
        level_depth_base: 1000,
        level_growth_coefficient: 1.5,
        energy_gain_coefficient: 0.01,
      },
    }

    const result = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.SetConfig.actionName,
            authorization: [
              {
                actor: testCoop,
                permission: 'active',
              },
            ],
            data,
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )
    getTotalRamUsage(result)
    expect(result.transaction_id).toBeDefined()

    const state = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      CapitalContract.contractName.production,
      'state',
      1,
      testCoop,
      testCoop,
    ))[0]
    console.log('state: ', state)
    expect(state).toBeDefined()
    expect(state.coopname).toBe(testCoop)
    expect(parseFloat(state.config.coordinator_bonus_percent)).toBe(data.config.coordinator_bonus_percent)
    expect(parseFloat(state.config.expense_pool_percent)).toBe(data.config.expense_pool_percent)
    expect(parseFloat(state.config.coordinator_invite_validity_days)).toBe(data.config.coordinator_invite_validity_days)
    expect(parseFloat(state.config.voting_period_in_days)).toBe(data.config.voting_period_in_days)
    expect(parseFloat(state.config.authors_voting_percent)).toBe(data.config.authors_voting_percent)
    expect(parseFloat(state.config.creators_voting_percent)).toBe(data.config.creators_voting_percent)
  })

  it('импорт вкладчика ПОСЛЕ установки конфига - должен провалиться', async () => {
    // Создаем еще одного тестового пользователя для импорта
    const importUsername2 = generateRandomUsername()
    console.log('importUsername2: ', importUsername2)
    await addUser(importUsername2)

    const contributorHash2 = generateRandomSHA256()
    const contributionAmount2 = '5000.0000 RUB'

    // Пытаемся импортировать вкладчика после установки конфига
    const importData2: CapitalContract.Actions.ImportContributor.IImportContributor = {
      coopname: testCoop,
      username: importUsername2,
      contributor_hash: contributorHash2,
      contribution_amount: contributionAmount2,
      memo: 'договор №123 от такого то числа',
    }

    // Ожидаем, что транзакция провалится
    await expect(
      blockchain.api.transact(
        {
          actions: [
            {
              account: CapitalContract.contractName.production,
              name: CapitalContract.Actions.ImportContributor.actionName,
              authorization: [
                {
                  actor: testCoop,
                  permission: 'active',
                },
              ],
              data: importData2,
            },
          ],
        },
        {
          blocksBehind: 3,
          expireSeconds: 30,
        },
      ),
    ).rejects.toThrow() // Ожидаем ошибку

    // Проверяем, что вкладчик НЕ был создан
    const contributorTable = await blockchain.getTableRows(
      CapitalContract.contractName.production,
      testCoop,
      'contributors',
    )
    expect(contributorTable.length).toBe(1)

    // Проверяем, что кошелек программы НЕ был создан
    const wallet = await getUserProgramWalletAmount(blockchain, testCoop, importUsername2, capitalProgramId)
    expect(wallet).toBe('0.0000 RUB')
  })
})
