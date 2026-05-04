import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CapitalContract, SovietContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { getTotalRamUsage, globalRamStats } from '../utils/getTotalRamUsage'
import { addUser } from '../init/participant'
import { generateRandomUsername } from '../utils/randomUsername'
import { generateRandomSHA256 } from '../utils/randomHash'
import { generateRandomContributionAmount, generateRandomDescription, generateRandomMeta, generateRandomProjectData, generateRandomPropertyDescription, sleep } from '../utils'
import { getCoopProgramWallet, getLedgerAccountById, getUserProgramWalletAmount } from './wallet/walletUtils'
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
import { processRegShare } from './capital/processRegShare'
// const CLI_PATH = 'src/index.ts'

const blockchain = new Blockchain(config.network, config.private_keys)
let metaProject: CapitalContract.Actions.CreateProject.ICreateProject
let componentProject: CapitalContract.Actions.CreateProject.ICreateProject
let newComponentProject: CapitalContract.Actions.CreateProject.ICreateProject

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

let totalToCapitalConvertAmount = 0
let totalToProjectConvertAmount = 0

// Baseline ledger2-кошельков перед первым approvecmmt компонента-проекта.
// Нужен для инвариант-проверки «w.cap.gncom (ЦПП «Генератор» — коммит) проекта
// закрылся в ноль» после полного цикла commits→voting→pushResult→signact2→
// convertsegm: approvecmmt(commit) кладёт на w.cap.gncom commit.amounts.
// total_contribution, signact2(сегмента) забирает segment.available_for_program.
// Сумма выдач и приходов проекта обязана совпадать — иначе либо коммит попал
// на w.cap.gncom неправильной суммой, либо часть пайщиков не сконвертировала.
//
// Имена кошельков — eosio::name (рефакт 2026-04-27). Старые numeric ID
// (10001/9002) больше не используются — wallets.id теперь string.
const WALLET_GENERATOR_COMMIT = 'w.cap.gncom'
const WALLET_BLAGOROST_RID = 'w.cap.bgrid'
let generatorCommitBaselineRub = 0
let blagorostRidBaselineRub = 0
// Хранение хэшей долгов для каждого пользователя
let userDebtHashes: { [username: string]: string[] } = {}
beforeAll(async () => {
  await blockchain.update_pass_instance()

  investor1 = generateRandomUsername()
  console.log('investor1: ', investor1)
  await addUser(investor1)

  tester1 = generateRandomUsername()
  console.log('tester1: ', tester1)
  await addUser(tester1)

  tester2 = generateRandomUsername()
  console.log('tester2: ', tester2)
  await addUser(tester2)

  tester3 = generateRandomUsername()
  console.log('tester3: ', tester3)
  await addUser(tester3)

  tester4 = generateRandomUsername()
  console.log('tester4: ', tester4)
  await addUser(tester4)

  tester5 = generateRandomUsername()
  console.log('tester5: ', tester5)
  await addUser(tester5)

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
  await addUser(investor2, tester4)

  investor3 = generateRandomUsername()
  console.log('investor3: ', investor3)
  await addUser(investor3, tester5)

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

  console.log(`tester1: ${tester1}\ntester2: ${tester2}\ntester3: ${tester3}\ntester4: ${tester4}\ntester5: ${tester5}\ninvestor1: ${investor1}\ninvestor2: ${investor2}\ninvestor3: ${investor3}`)
})

describe('тест контракта CAPITAL', () => {
  it('создаём программу генерации', async () => {
    const program = await getCoopProgramWallet(blockchain, 'voskhod', sourceProgramId)
    if (!program) {
      const data: SovietContract.Actions.Programs.CreateProgram.ICreateProgram = {
        coopname: 'voskhod',
        is_can_coop_spend_share_contributions: true,
        username: 'ant',
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
                  actor: 'ant',
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
    const program = await getCoopProgramWallet(blockchain, 'voskhod', capitalProgramId)

    if (!program) {
      const data: SovietContract.Actions.Programs.CreateProgram.ICreateProgram = {
        coopname: 'voskhod',
        is_can_coop_spend_share_contributions: false,
        username: 'ant',
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
                  actor: 'ant',
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

  it('инициализируем контракт CAPITAL и сверяем конфиг', async () => {
    const data: CapitalContract.Actions.SetConfig.ISetConfig = {
      coopname: 'voskhod',
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
                actor: 'voskhod',
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
      'voskhod',
      'voskhod',
    ))[0]
    console.log('state: ', state)
    expect(state).toBeDefined()
    expect(state.coopname).toBe('voskhod')
    expect(parseFloat(state.config.coordinator_bonus_percent)).toBe(data.config.coordinator_bonus_percent)
    expect(parseFloat(state.config.expense_pool_percent)).toBe(data.config.expense_pool_percent)
    expect(parseFloat(state.config.coordinator_invite_validity_days)).toBe(data.config.coordinator_invite_validity_days)
    expect(parseFloat(state.config.voting_period_in_days)).toBe(data.config.voting_period_in_days)
    expect(parseFloat(state.config.authors_voting_percent)).toBe(data.config.authors_voting_percent)
    expect(parseFloat(state.config.creators_voting_percent)).toBe(data.config.creators_voting_percent)
  })

  it('создаём мета-проект и компонент-проект', async () => {
    // Создаём мета-проект
    const metaHash = generateRandomSHA256()
    const parentHash = '0000000000000000000000000000000000000000000000000000000000000000'

    const metaData: CapitalContract.Actions.CreateProject.ICreateProject = {
      coopname: 'voskhod',
      project_hash: metaHash,
      parent_hash: parentHash,
      title: `Мета-проект ${metaHash.slice(0, 10)}`,
      description: generateRandomDescription(),
      invite: '',
      data: generateRandomProjectData(800, 1500),
      meta: generateRandomMeta(),
    }

    metaProject = metaData

    const metaResult = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.CreateProject.actionName,
            authorization: [
              {
                actor: 'voskhod',
                permission: 'active',
              },
            ],
            data: metaData,
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    expect(metaResult.transaction_id).toBeDefined()
    getTotalRamUsage(metaResult)

    // Создаём компонент-проект
    const componentHash = generateRandomSHA256()

    const componentData: CapitalContract.Actions.CreateProject.ICreateProject = {
      coopname: 'voskhod',
      project_hash: componentHash,
      parent_hash: metaHash, // Родительский хэш указывает на мета-проект
      title: `Компонент-проект ${componentHash.slice(0, 10)}`,
      description: generateRandomDescription(),
      meta: generateRandomMeta(),
      data: generateRandomProjectData(1000, 2500),
      invite: '',
    }

    componentProject = componentData

    const componentResult = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.CreateProject.actionName,
            authorization: [
              {
                actor: 'voskhod',
                permission: 'active',
              },
            ],
            data: componentData,
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    expect(componentResult.transaction_id).toBeDefined()
    getTotalRamUsage(componentResult)

    // Проверяем мета-проект
    const metaProjectState = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      metaProject.project_hash,
      metaProject.project_hash,
      3,
      'sha256',
    ))[0]

    expect(metaProjectState).toBeDefined()
    console.log('meta project: ', metaProjectState)
    expect(metaProjectState.coopname).toBe('voskhod')
    expect(metaProjectState.status).toBe('pending')
    expect(metaProjectState.parent_hash).toBe('0000000000000000000000000000000000000000000000000000000000000000')

    // Проверяем компонент-проект
    const componentProjectState = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      componentProject.project_hash,
      componentProject.project_hash,
      3,
      'sha256',
    ))[0]

    expect(componentProjectState).toBeDefined()
    console.log('component project: ', componentProjectState)
    expect(componentProjectState.coopname).toBe('voskhod')
    expect(componentProjectState.status).toBe('pending')
    expect(componentProjectState.parent_hash).toBe(metaProject.project_hash)

    console.log(`✅ Создали мета-проект: ${metaProject.project_hash}`)
    console.log(`✅ Создали компонент-проект: ${componentProject.project_hash} (parent: ${metaProject.project_hash})`)
  })

  it('заключаем договор УХД, приложение к мета-проекту и проекту компоненту со множеством участников', async () => {
    const testerNames = [tester1, tester2, tester3, tester4, tester5, investor1, investor2, investor3]
    for (const tester of testerNames) {
      const appendixHash = generateRandomSHA256()
      const metaAppendixHash = generateRandomSHA256()
      const contributorHash = generateRandomSHA256()
      // Используем разные суммы для каждого участника
      const contributionAmount = '1000.0000 RUB'
      console.log(`Регистрируем ${tester} с взносом ${contributionAmount}`)
      await registerContributor(blockchain, 'voskhod', tester, contributorHash, contributionAmount)
      await signAppendix(blockchain, 'voskhod', tester, metaProject.project_hash, metaAppendixHash)
      await signAppendix(blockchain, 'voskhod', tester, componentProject.project_hash, appendixHash)

      const contributor = (await blockchain.getTableRows(
        CapitalContract.contractName.production,
        'voskhod',
        'contributors',
        1,
        tester,
        tester,
        2,
        'i64',
      ))[0]
      expect(contributor).toBeDefined()
      expect(contributor.appendixes).toContain(metaProject.project_hash)
      expect(contributor.appendixes).toContain(componentProject.project_hash)
      expect(contributor.status).toBe('active')
    }
  }, 1000_000)

  it(`подписываем соглашения о ЦПП "Цифровой Кошелек" и "Капитализация"`, async () => {
    const testerNames = [tester1, tester2, tester3, tester4, tester5, investor1, investor2, investor3] // Можно передавать любое количество пользователей

    for (const tester of testerNames) {
      await signWalletAgreement(blockchain, 'voskhod', tester, fakeDocument)
      await signCapitalAgreement(blockchain, 'voskhod', tester, fakeDocument)
    }
  }, 1000_000)

  it(`пополняем баланс кошелька investor1`, async () => {
    const { depositId, program, userWallet } = await depositToWallet(blockchain, 'voskhod', investor1, investAmount1)
  })

  it(`пополняем баланс кошелька investor2`, async () => {
    const { depositId, program, userWallet } = await depositToWallet(blockchain, 'voskhod', investor2, investAmount2 * 2)
  })

  it(`пополняем баланс кошелька investor3`, async () => {
    const { depositId, program, userWallet } = await depositToWallet(blockchain, 'voskhod', investor3, investAmount3)
  })

  it('добавляем мастера к проекту', async () => {
    const data: CapitalContract.Actions.SetMaster.ISetMaster = {
      coopname: 'voskhod',
      project_hash: componentProject.project_hash,
      master: tester1,
    }

    const result = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.SetMaster.actionName,
            authorization: [
              {
                actor: 'voskhod',
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

    const project = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      componentProject.project_hash,
      componentProject.project_hash,
      3,
      'sha256',
    ))[0]

    expect(project).toBeDefined()
    console.log('project: ', project)
    expect(project.master).toBe(tester1)

    const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, tester1)
    expect(segment.is_author).toBe(1)
  })

  // не делаем потому что мастер - это сразу и автор сейчас.
  // it('добавляем автора к идее', async () => {
  //   const { project, segment } = await addAuthor(blockchain, 'voskhod', componentProject.project_hash, tester2)

  //   console.log('segment: ', segment)
  //   expect(segment).toBeDefined()
  //   expect(segment.username).toBe(tester2)
  //   expect(segment.project_hash).toBe(componentProject.project_hash)
  //   expect(segment.is_author).toBe(1)
  //   expect(segment.is_creator).toBe(0)
  //   expect(segment.is_coordinator).toBe(0)
  //   expect(segment.is_investor).toBe(0)
  //   expect(segment.is_contributor).toBe(0)
  //   expect(segment.is_coordinator).toBe(0)
  //   expect(segment.is_investor).toBe(0)
  //   expect(segment.is_contributor).toBe(0)
  //   expect(project).toBeDefined()
  //   expect(project.counts.total_authors).toBe(1)
  // })

  it('устанавливаем план проекта', async () => {
    const data: CapitalContract.Actions.SetPlan.ISetPlan = {
      coopname: 'voskhod',
      master: tester1,
      project_hash: componentProject.project_hash,
      plan_creators_hours: 100,
      plan_expenses: '10000.0000 RUB',
      plan_hour_cost: '1000.0000 RUB',
    }

    const result = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.SetPlan.actionName,
            authorization: [
              {
                actor: 'voskhod',
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

    const project = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      componentProject.project_hash,
      componentProject.project_hash,
      3,
      'sha256',
    ))[0]

    expect(project).toBeDefined()
    console.log('plan: ', project.plan)
    // Проверяем плановые показатели согласно формулам из generation.cpp
    expect(project.plan.hour_cost).toBe('1000.0000 RUB')
    expect(parseInt(project.plan.creators_hours)).toBe(100)
    expect(project.plan.target_expense_pool).toBe('10000.0000 RUB')

    // Себестоимости и премии
    expect(project.plan.creators_base_pool).toBe('100000.0000 RUB')
    expect(project.plan.authors_base_pool).toBe('61800.0000 RUB')
    expect(project.plan.coordinators_base_pool).toBe('7158.3333 RUB')
    expect(project.plan.creators_bonus_pool).toBe('100000.0000 RUB')
    expect(project.plan.authors_bonus_pool).toBe('61800.0000 RUB')

    // Инвестиции и коэффициент возврата
    expect(project.plan.invest_pool).toBe('168958.3333 RUB')
    expect(project.plan.total_received_investments).toBe('178958.3333 RUB')
    expect(project.plan.coordinators_investment_pool).toBe('178958.3333 RUB')
    expect(parseFloat(project.plan.return_base_percent)).toBeCloseTo(100, 10)
    expect(parseFloat(project.plan.use_invest_percent)).toBeCloseTo(100, 10)

    // Итого генерация, бонусы вкладчиков и общая сумма с расходами
    expect(project.plan.total_generation_pool).toBe('330758.3333 RUB')
    expect(project.plan.contributors_bonus_pool).toBe('204408.6499 RUB')
    expect(project.plan.total).toBe('535166.9832 RUB')
  })

  it('стартовать проект на приём коммитов', async () => {
    const data: CapitalContract.Actions.StartProject.IStartProject = {
      coopname: 'voskhod',
      project_hash: componentProject.project_hash,
    }
    const tx = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.StartProject.actionName,
            authorization: [{ actor: 'voskhod', permission: 'active' }],
            data,
          },
        ],
      },
      { blocksBehind: 3, expireSeconds: 30 },
    )
    getTotalRamUsage(tx)
    expect(tx.transaction_id).toBeDefined()

    const project = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      componentProject.project_hash,
      componentProject.project_hash,
      3,
      'sha256',
    ))[0]
    expect(project).toBeDefined()
    expect(project.status).toBe('active')
  })

  it('snapshot ledger2-кошельков перед первым approvecmmt компонента (baseline для инвариант-теста)', async () => {
    // Берём baseline ровно перед первым approvecmmt componentProject:
    // approvecmmt(tester1) ниже первым эмитит COMMIT_RID на w.cap.gncom
    // (ЦПП «Генератор» — коммит). Финальный assert «w.cap.gncom проекта
    // вернулся к baseline» сравнивает дельту по этому проекту, а не
    // абсолютный остаток (на w.cap.gncom могут быть остатки property-
    // операций или будущих компонентов в одном тесте).
    const wallets = await blockchain.getTableRows('ledger2', 'voskhod', 'wallets', 500) as Array<{ id: string, available: string, blocked: string }>
    const generator = wallets.find((w) => String(w.id) === WALLET_GENERATOR_COMMIT)
    const blagorost = wallets.find((w) => String(w.id) === WALLET_BLAGOROST_RID)
    generatorCommitBaselineRub = generator
      ? parseFloat(generator.available.split(' ')[0]) + parseFloat(generator.blocked.split(' ')[0])
      : 0
    blagorostRidBaselineRub = blagorost
      ? parseFloat(blagorost.available.split(' ')[0]) + parseFloat(blagorost.blocked.split(' ')[0])
      : 0
    console.log(`📌 baseline ${WALLET_GENERATOR_COMMIT}=${generatorCommitBaselineRub} ${WALLET_BLAGOROST_RID}=${blagorostRidBaselineRub}`)
  })

  it('добавить коммит создателя tester1 на 10 часов по 1000 RUB', async () => {
    const { finalProject, commitHash, commit } = await commitToResult(blockchain, 'voskhod', componentProject.project_hash, tester1, tester1CommitHours)
    commits.push(commitHash)

    console.log('commit: ', commit)
    console.log('project fact: ', finalProject.fact)
    expect(finalProject.fact.creators_hours).toBe(10)
    expect(finalProject.fact.creators_base_pool).toBe('10000.0000 RUB')
    expect(finalProject.fact.creators_bonus_pool).toBe('10000.0000 RUB')
    expect(finalProject.fact.authors_bonus_pool).toBe('6180.0000 RUB')
    expect(finalProject.fact.total_generation_pool).toBe('32360.0000 RUB')
    expect(finalProject.fact.contributors_bonus_pool).toBe('19998.4800 RUB')
    expect(finalProject.fact.total).toBe('52358.4800 RUB')
  })

  it('обновить CRPS и проверить распределение авторских наград после первого коммита', async () => {
    // Обновляем сегмент tester1 через CRPS
    const { prevSegment, updatedSegment } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester1)

    console.log('Сегмент до обновления:', prevSegment)
    console.log('Сегмент после обновления:', updatedSegment)

    // Проверяем, что весь пул авторских вознаграждений распределился одному автору
    // В проекте authors_bonus_pool = '6180.0000 RUB' должен полностью перейти в author_bonus
    expect(updatedSegment.author_bonus).toBe('6180.0000 RUB')

    // Базовая награда автора также должна быть распределена
    // Из формулы генерации: base_bonus_coefficient * authors_bonus_pool / total_authors = 1.0 * 6180 / 1 = 6180
    expect(updatedSegment.author_base).toBe('6180.0000 RUB')

    // Проверяем, что is_author = true
    expect(updatedSegment.is_author).toBe(1)

    console.log(`✅ Авторские награды успешно распределены: base=${updatedSegment.author_base}, bonus=${updatedSegment.author_bonus}`)
  })

  it('добавляем второго автора tester2 к идее', async () => {
    const { project, segment } = await addAuthor(blockchain, 'voskhod', componentProject.project_hash, tester2)

    console.log('segment tester2: ', segment)
    expect(segment).toBeDefined()
    expect(segment.username).toBe(tester2)
    expect(segment.project_hash).toBe(componentProject.project_hash)
    expect(segment.is_author).toBe(1)
    expect(segment.is_creator).toBe(0)
    expect(segment.is_coordinator).toBe(0)
    expect(segment.is_investor).toBe(0)
    expect(segment.is_contributor).toBe(0)
    expect(project).toBeDefined()
    expect(project.counts.total_authors).toBe(2) // Теперь у нас 2 автора
  })

  it('добавить коммит создателя tester2 на 20 часов по 1000 RUB', async () => {
    const { finalProject, commitHash, commit } = await commitToResult(blockchain, 'voskhod', componentProject.project_hash, tester2, tester2CommitHours)
    commits.push(commitHash)

    console.log('commit tester2: ', commit)
    console.log('project fact after tester2 commit: ', finalProject.fact)

    expect(commit.amounts.creators_base_pool).toBe('20000.0000 RUB')
    expect(commit.amounts.creators_bonus_pool).toBe('20000.0000 RUB')
    expect(commit.amounts.authors_bonus_pool).toBe('12360.0000 RUB')
    expect(commit.amounts.authors_base_pool).toBe('12360.0000 RUB')
    expect(commit.amounts.total_generation_pool).toBe('64720.0000 RUB')
    expect(commit.amounts.contributors_bonus_pool).toBe('39996.9600 RUB')
    expect(commit.amounts.total_contribution).toBe('104716.9600 RUB')

    // Проверяем накопительные значения после двух коммитов (10 + 20 = 30 часов)
    expect(finalProject.fact.creators_hours).toBe(30)
    expect(finalProject.fact.creators_base_pool).toBe('30000.0000 RUB')
    expect(finalProject.fact.creators_bonus_pool).toBe('30000.0000 RUB')
    expect(finalProject.fact.authors_bonus_pool).toBe('18540.0000 RUB')
    expect(finalProject.fact.total_generation_pool).toBe('97080.0000 RUB')
    expect(finalProject.fact.contributors_bonus_pool).toBe('59995.4400 RUB')
    expect(finalProject.fact.total).toBe('157075.4400 RUB')
  })

  it('обновить CRPS для обоих авторов и проверить распределение авторских наград', async () => {
    // Обновляем сегмент tester1 через CRPS
    await sleep(1000) // т.к. ранее мы делали обновление и будет дублирование - надо подождать
    const { prevSegment: prevTester1, updatedSegment: updatedTester1 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester1)
    // Обновляем сегмент tester2 через CRPS
    const { prevSegment: prevTester2, updatedSegment: updatedTester2 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester2)

    // console.log('Tester1 - сегмент до обновления:', prevTester1)
    // console.log('Tester1 - сегмент после обновления:', updatedTester1)
    // console.log('Tester2 - сегмент до обновления:', prevTester2)
    // console.log('Tester2 - сегмент после обновления:', updatedTester2)

    // Получаем проект для проверки текущего authors_bonus_pool
    const project = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      componentProject.project_hash,
      componentProject.project_hash,
      3,
      'sha256',
    ))[0]

    console.log('Current project authors_bonus_pool:', project.fact.authors_bonus_pool)

    // После второго коммита авторский пул составляет 18540 RUB, прирост составил 12360 RUB
    // Он должен распределиться поровну между двумя авторами: 12360 / 2 = 6180 RUB каждому

    // Проверяем tester1 (у него была награда от первого коммита + доля от второго)
    // tester1 должен получить: 6180 (от первого коммита) + 6180 (доля от второго) = 12360
    // Но поскольку распределение происходит от текущего пула, каждый получает половину от 12360 = 6180
    expect(updatedTester1.author_bonus).toBe('12360.0000 RUB')
    expect(updatedTester1.author_base).toBe('12360.0000 RUB')
    // Проверяем что сумма к ссуде равна 0 т.к. инвестиций нет
    expect(updatedTester1.provisional_amount).toBe('0.0000 RUB')

    // Проверяем tester2 (получает свою долю от текущего пула)
    expect(updatedTester2.author_bonus).toBe('6180.0000 RUB')
    expect(updatedTester2.author_base).toBe('6180.0000 RUB')
    // Проверяем что сумма к ссуде равна 0 т.к. инвестиций нет
    expect(updatedTester2.provisional_amount).toBe('0.0000 RUB')

    // Проверяем, что оба являются авторами
    expect(updatedTester1.is_author).toBe(1)
    expect(updatedTester2.is_author).toBe(1)

    console.log(`✅ Авторские награды успешно распределены между двумя авторами:`)
    console.log(`   tester1: base=${updatedTester1.author_base}, bonus=${updatedTester1.author_bonus}`)
    console.log(`   tester2: base=${updatedTester2.author_base}, bonus=${updatedTester2.author_bonus}`)
  })

  it('проверяем, что оба пайщика являются авторами и создателями', async () => {
    const segment1 = await getSegment(blockchain, 'voskhod', componentProject.project_hash, tester1)
    const segment2 = await getSegment(blockchain, 'voskhod', componentProject.project_hash, tester2)
    expect(segment1.is_author).toBe(1)
    expect(segment2.is_author).toBe(1)
    expect(segment1.is_creator).toBe(1)
    expect(segment2.is_creator).toBe(1)
  })

  it('открыть приём инвестиций', async () => {
    const data: CapitalContract.Actions.OpenProject.IOpenProject = {
      coopname: 'voskhod',
      project_hash: componentProject.project_hash,
    }
    const result = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.OpenProject.actionName,
            authorization: [{ actor: 'voskhod', permission: 'active' }],
            data,
          },
        ],
      },
      { blocksBehind: 3, expireSeconds: 30 },
    )

    const project = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      componentProject.project_hash,
      componentProject.project_hash,
      3,
      'sha256',
    ))[0]
    console.log('project: ', project)
    expect(project).toBeDefined()
    expect(project.is_opened).toBe(1)
    expect(project.fact.target_expense_pool).toBe('10000.0000 RUB')
    expect(project.fact.accumulated_expense_pool).toBe('0.0000 RUB')
    expect(project.fact.used_expense_pool).toBe('0.0000 RUB')
  })

  it('инвестировать в проект аккаунтом investor1 на 100000 RUB', async () => {
    fakeDocument.signatures[0].signer = investor1
    const { project, transactionId } = await investInProject(blockchain, 'voskhod', investor1, componentProject.project_hash, `${investAmount1}.0000 RUB`, fakeDocument)
    expect(project).toBeDefined()
    expect(transactionId).toBeDefined()
    expect(project.fact.total_received_investments).toBe('100000.0000 RUB')
    expect(project.fact.invest_pool).toBe('90000.0000 RUB')
    expect(project.fact.accumulated_expense_pool).toBe('10000.0000 RUB')
    expect(parseFloat(project.fact.use_invest_percent)).toBeCloseTo(58.54, 1)
    expect(parseFloat(project.fact.return_base_percent)).toBeCloseTo(100, 1)
  })

  it('обновляем сегменты tester1, tester2 и investor1 и проверяем обеспечение инвестициями для ссуд', async () => {
    await sleep(1000)

    const { prevSegment: prevTester1, updatedSegment: updatedTester1 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester1)
    const { prevSegment: prevTester2, updatedSegment: updatedTester2 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester2)
    const { prevSegment: prevInvestor1, updatedSegment: updatedInvestor1 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, investor1)

    console.log('updatedTester1: ', updatedTester1)
    console.log('updatedTester2: ', updatedTester2)
    console.log('updatedInvestor1: ', updatedInvestor1)

    expect(updatedTester1.provisional_amount).toBe('22360.0000 RUB')
    expect(updatedTester2.provisional_amount).toBe('26180.0000 RUB')
    expect(updatedInvestor1.provisional_amount).toBe('0.0000 RUB')
    // Проверяем что сумма инвестиций равна 100000 RUB
    expect(updatedInvestor1.investor_amount).toBe('100000.0000 RUB')
    // Проверяем что используемая сумма инвестиций равна 58540 RUB
    expect(updatedInvestor1.investor_base).toBe('58540.0000 RUB')
  })

  it('tester3 вносит 100000 RUB коммитом и делает сумму инвестиций недостаточной для полного обеспечения', async () => {
    const { finalProject, commitHash, commit } = await commitToResult(blockchain, 'voskhod', componentProject.project_hash, tester3, tester3CommitHours)
    commits.push(commitHash)

    console.log('commit tester3: ', commit)
    console.log('project fact after tester3 commit: ', finalProject.fact)

    expect(finalProject.fact.creators_hours).toBe(130)
    expect(finalProject.fact.creators_base_pool).toBe('130000.0000 RUB')
    expect(finalProject.fact.creators_bonus_pool).toBe('130000.0000 RUB')
    expect(finalProject.fact.authors_base_pool).toBe('80340.0000 RUB')
    expect(finalProject.fact.authors_bonus_pool).toBe('80340.0000 RUB')
    expect(finalProject.fact.total_generation_pool).toBe('420680.0000 RUB')
    expect(finalProject.fact.contributors_bonus_pool).toBe('259980.2400 RUB')
    expect(finalProject.fact.total).toBe('680660.2400 RUB')

    expect(parseFloat(finalProject.fact.use_invest_percent)).toBeCloseTo(100, 1)
    expect(parseFloat(finalProject.fact.return_base_percent)).toBeCloseTo(42.78, 1)

    await sleep(1000)
    // Проверяем сегменты
    const { prevSegment: prevTester1, updatedSegment: updatedTester1 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester1)
    const { prevSegment: prevTester2, updatedSegment: updatedTester2 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester2)
    const { prevSegment: prevInvestor1, updatedSegment: updatedInvestor1 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, investor1)

    // console.log('prevTester2: ', prevTester2)
    // console.log('updatedTester2: ', updatedTester2)
    // console.log('updatedInvestor1: ', updatedInvestor1)

    expect(updatedTester1.provisional_amount).toBe('22788.8181 RUB')
    expect(updatedTester2.provisional_amount).toBe('24423.3146 RUB')
    expect(updatedInvestor1.provisional_amount).toBe('0.0000 RUB')
    expect(updatedInvestor1.investor_base).toBe('100000.0000 RUB')
    expect(updatedInvestor1.investor_amount).toBe('100000.0000 RUB')
  })

  it('инвестировать в проект аккаунтом investor2 на 25000 RUB с координатором tester4', async () => {
    fakeDocument.signatures[0].signer = investor2
    const { project, prevProject, transactionId } = await investInProject(blockchain, 'voskhod', investor2, componentProject.project_hash, `${investAmount2}.0000 RUB`, fakeDocument)
    expect(project).toBeDefined()
    expect(transactionId).toBeDefined()
    // console.log('prevProject: ', prevProject)
    // console.log('project: ', project)
    expect(project.counts.total_coordinators).toBe(1)
    expect(project.fact.coordinators_investment_pool).toBe('25000.0000 RUB')
    expect(project.fact.coordinators_base_pool).toBe('1000.0000 RUB')
    expect(project.fact.total_received_investments).toBe('125000.0000 RUB')
    expect(parseFloat(project.fact.return_base_percent)).toBeCloseTo(54.42, 1)
    expect(parseFloat(project.fact.use_invest_percent)).toBeCloseTo(100, 1)

    // Проверяем сегменты
    const { prevSegment: prevTester4, updatedSegment: updatedTester4 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester4)
    expect(updatedTester4.provisional_amount).toBe('544.1468 RUB')
    expect(updatedTester4.coordinator_base).toBe('1000.0000 RUB')
    expect(updatedTester4.is_coordinator).toBe(1)
    expect(updatedTester4.coordinator_investments).toBe('25000.0000 RUB')

    console.log('updatedTester4: ', updatedTester4)

    const { prevSegment: prevInvestor2, updatedSegment: updatedInvestor2 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, investor2)
    console.log('updatedInvestor2: ', updatedInvestor2)
    expect(updatedInvestor2.provisional_amount).toBe('0.0000 RUB')
    expect(updatedInvestor2.investor_base).toBe('25000.0000 RUB')
    expect(updatedInvestor2.investor_amount).toBe('25000.0000 RUB')
  })

  it('инвестировать в проект аккаунтом investor3 еще на 25000 RUB с координатором tester5', async () => {
    fakeDocument.signatures[0].signer = investor3
    const { project, prevProject, transactionId } = await investInProject(blockchain, 'voskhod', investor3, componentProject.project_hash, `${investAmount3}.0000 RUB`, fakeDocument)
    expect(project).toBeDefined()
    expect(transactionId).toBeDefined()
    // console.log('prevProject: ', prevProject)
    console.log('project: ', project)
    expect(project.counts.total_coordinators).toBe(2)
    expect(project.fact.coordinators_investment_pool).toBe('50000.0000 RUB')
    expect(project.fact.coordinators_base_pool).toBe('2000.0000 RUB')
    expect(project.fact.total_received_investments).toBe('150000.0000 RUB')
    expect(parseFloat(project.fact.return_base_percent)).toBeCloseTo(65.9558, 1)
    expect(parseFloat(project.fact.use_invest_percent)).toBeCloseTo(100, 1)

    const { prevSegment: prevTester5, updatedSegment: updatedTester5 } = await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester5)
    // console.log('updatedTester5: ', updatedTester5)
    expect(updatedTester5.provisional_amount).toBe('659.3199 RUB')
    expect(updatedTester5.coordinator_base).toBe('1000.0000 RUB')
    expect(updatedTester5.is_coordinator).toBe(1)
    expect(updatedTester5.coordinator_investments).toBe('25000.0000 RUB')
  })

  it(`берем ссуду на 10000 RUB от tester1`, async () => {
    // Обновляем сегмент перед получением ссуды
    await sleep(1000)
    await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester1)
    const repaidAtDate = new Date()
    repaidAtDate.setDate(repaidAtDate.getDate() + 30)

    // Процессим полный цикл получения долга
    const debtResult = await processDebt(
      blockchain,
      'voskhod',
      tester1,
      componentProject.project_hash,
      '10000.0000 RUB',
      fakeDocument,
      repaidAtDate,
    )
    // Сохраняем хэш долга для последующего использования
    userDebtHashes[tester1].push(debtResult.debtHash)

    // Проверяем что debt_amount увеличился на 10000.0000 RUB в сегменте
    expect(debtResult.segmentAfter.debt_amount).toBe('10000.0000 RUB')

    // Проверяем что debt_amount увеличился у контрибьютора
    expect(debtResult.contributorAfter.debt_amount).toBe('10000.0000 RUB')

    console.log(`✅ Долг на 10000.0000 RUB успешно получен пользователем ${tester1}`)
  })

  it('внести имущество на 10000 RUB в проект от tester4', async () => {
    const data: CapitalContract.Actions.CreateProjectProperty.ICreateProjectProperty = {
      coopname: 'voskhod',
      username: tester4,
      project_hash: componentProject.project_hash,
      property_hash: generateRandomSHA256(),
      property_amount: '10000.0000 RUB',
      property_description: generateRandomPropertyDescription(),
    }

    const res = await processCreateProjectProperty(blockchain, data)
    const prevTotalCost = parseFloat(res.segmentBefore.total_segment_cost)

    expect(res.segmentAfter.total_segment_cost).not.toBe(res.segmentBefore.total_segment_cost)
    expect(parseFloat(res.segmentAfter.total_segment_cost)).toBeGreaterThan(prevTotalCost)

    // Проверяем точное приращение
    const prevContributedAsPropertor = parseFloat(res.segmentBefore.property_base.split(' ')[0])
    const afterContributedAsPropertor = parseFloat(res.segmentAfter.property_base.split(' ')[0])
    expect(afterContributedAsPropertor).toBe(prevContributedAsPropertor + 10000)

    const programWalletBefore = await getCoopProgramWallet(blockchain, 'voskhod', capitalProgramId)
  })

  it('внести программный имущественный взнос на 10000 RUB от tester5 и проверить точное приращение блокированных средств и паевого фонда', async () => {
    const programWalletBefore = await getCoopProgramWallet(blockchain, 'voskhod', capitalProgramId)
    const ledgerShareBefore = await getLedgerAccountById(blockchain, 'voskhod', circulationAccountId)

    const data: CapitalContract.Actions.CreateProgramProperty.ICreateProgramProperty = {
      coopname: 'voskhod',
      username: tester5,
      property_hash: generateRandomSHA256(),
      property_amount: '10000.0000 RUB',
      property_description: generateRandomPropertyDescription(),
      statement: fakeDocument,
    }

    // добавляем в ожидаемую общую сумму программы благороста
    totalToCapitalConvertAmount += parseFloat(data.property_amount.split(' ')[0])

    const res = await processCreateProgramProperty(blockchain, data, fakeDocument)
    expect(res.txCreateId).toBeDefined()
    expect(res.txAct1Id).toBeDefined()
    expect(res.txAct2Id).toBeDefined()

    // Логирование состояний до/после
    // console.log('Program wallet before:', res.programWalletBefore)
    // console.log('Program wallet after:', res.programWalletAfter)
    // console.log('Ledger share before:', res.ledgerShareBefore)
    // console.log('Ledger share after:', res.ledgerShareAfter)

    // Проверяем точное приращение: блокированные средства программы +10000.0000 RUB
    const prevBlocked = parseFloat(res.programWalletBefore.blocked.split(' ')[0])
    const afterBlocked = parseFloat(res.programWalletAfter.blocked.split(' ')[0])
    expect(afterBlocked).toBe(prevBlocked + 10000)

    // Проверяем точное приращение: паевой фонд в бухгалтерии +10000.0000 RUB
    const prevAvailable = parseFloat(res.ledgerShareBefore.available.split(' ')[0])
    const afterAvailable = parseFloat(res.ledgerShareAfter.available.split(' ')[0])
    expect(afterAvailable).toBe(prevAvailable + 10000)
  })

  it('внести проектный имущественный взнос на 10000 RUB от tester5 и проверить точное приращение в сегменте проекта', async () => {
    const data: CapitalContract.Actions.CreateProjectProperty.ICreateProjectProperty = {
      coopname: 'voskhod',
      username: tester5,
      property_hash: generateRandomSHA256(),
      property_amount: '10000.0000 RUB',
      property_description: generateRandomPropertyDescription(),
      project_hash: componentProject.project_hash,
    }

    const res = await processCreateProjectProperty(blockchain, data)
    expect(res.txCreateId).toBeDefined()

    // Логирование состояний до/после
    // console.log('Segment before:', res.segmentBefore)
    // console.log('Segment after:', res.segmentAfter)
    // console.log('Project before:', res.projectBefore)
    // console.log('Project after:', res.projectAfter)

    // Проверяем точное приращение: имущественный взнос в сегменте +10000.0000 RUB
    const prevProperty = parseFloat(res.segmentBefore.property_base.split(' ')[0])
    const afterProperty = parseFloat(res.segmentAfter.property_base.split(' ')[0])
    expect(afterProperty).toBe(prevProperty + 10000)

    // Проверяем точное приращение: общая стоимость сегмента +10000.0000 RUB
    const prevTotal = parseFloat(res.segmentBefore.total_segment_cost.split(' ')[0])
    const afterTotal = parseFloat(res.segmentAfter.total_segment_cost.split(' ')[0])
    expect(afterTotal).toBe(prevTotal + 10000)

    // Проверяем точное приращение: имущественная база проекта +10000.0000 RUB
    const prevPropertyBase = parseFloat(res.projectBefore.fact.property_base_pool.split(' ')[0])
    const afterPropertyBase = parseFloat(res.projectAfter.fact.property_base_pool.split(' ')[0])
    expect(afterPropertyBase).toBe(prevPropertyBase + 10000)
    expect(afterPropertyBase).toBe(20000)
  })

  it(`берем ссуду координатору 100 RUB от tester4`, async () => {
    // Обновляем сегмент перед получением ссуды
    await sleep(1000)
    await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester4)
    const repaidAtDate = new Date()
    repaidAtDate.setDate(repaidAtDate.getDate() + 30)

    // Процессим полный цикл получения долга
    const debtResult = await processDebt(
      blockchain,
      'voskhod',
      tester4,
      componentProject.project_hash,
      '100.0000 RUB',
      fakeDocument,
      repaidAtDate,
    )

    // Сохраняем хэш долга для последующего использования
    userDebtHashes[tester4].push(debtResult.debtHash)

    // Проверяем что debt_amount увеличился на 100 RUB в сегменте
    expect(debtResult.segmentAfter.debt_amount).toBe('100.0000 RUB')

    // Проверяем что debt_amount увеличился у контрибьютора
    expect(debtResult.contributorAfter.debt_amount).toBe('100.0000 RUB')

    // Проверяем что долг перешел в статус 'paid' (готов к использованию/погашению)
    expect(debtResult.debtAfter.status).toBe('paid')

    console.log('debtResult tester4: ', debtResult)
    console.log(`Сохранен debt_hash для ${tester4}:`, debtResult.debtHash)

    console.log(`✅ Долг на 100 RUB успешно получен пользователем ${tester4}`)
  })

  it(`берем ссуду создателю 200 RUB от tester1`, async () => {
    // Обновляем сегмент перед получением ссуды
    await sleep(1000)
    await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester1)
    const repaidAtDate = new Date()
    repaidAtDate.setDate(repaidAtDate.getDate() + 30)

    // Процессим полный цикл получения долга
    const debtResult = await processDebt(
      blockchain,
      'voskhod',
      tester1,
      componentProject.project_hash,
      '200.0000 RUB',
      fakeDocument,
      repaidAtDate,
    )

    // Сохраняем хэш долга для последующего использования
    userDebtHashes[tester1].push(debtResult.debtHash)

    // Проверяем что debt_amount увеличился на 200 RUB в сегменте (плюс предыдущий долг 10000)
    expect(debtResult.segmentAfter.debt_amount).toBe('10200.0000 RUB')

    // Проверяем что debt_amount увеличился у контрибьютора
    expect(debtResult.contributorAfter.debt_amount).toBe('10200.0000 RUB')

    // Проверяем что долг перешел в статус 'paid' (готов к использованию/погашению)
    expect(debtResult.debtAfter.status).toBe('paid')

    console.log('debtResult tester1: ', debtResult)
    console.log(`Сохранен debt_hash для ${tester1}:`, debtResult.debtHash)

    console.log(`✅ Долг на 200 RUB успешно получен пользователем ${tester1}`)
  })

  it(`берем ссуду создателю 150 RUB от tester2`, async () => {
    // Обновляем сегмент перед получением ссуды
    await sleep(1000)
    await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester2)
    const repaidAtDate = new Date()
    repaidAtDate.setDate(repaidAtDate.getDate() + 30)

    // Процессим полный цикл получения долга
    const debtResult = await processDebt(
      blockchain,
      'voskhod',
      tester2,
      componentProject.project_hash,
      '150.0000 RUB',
      fakeDocument,
      repaidAtDate,
    )

    // Сохраняем хэш долга для последующего использования
    userDebtHashes[tester2].push(debtResult.debtHash)

    // Проверяем что debt_amount увеличился на 150 RUB в сегменте
    expect(debtResult.segmentAfter.debt_amount).toBe('150.0000 RUB')

    // Проверяем что debt_amount увеличился у контрибьютора
    expect(debtResult.contributorAfter.debt_amount).toBe('150.0000 RUB')

    // Проверяем что долг перешел в статус 'paid' (готов к использованию/погашению)
    expect(debtResult.debtAfter.status).toBe('paid')

    console.log('debtResult tester2: ', debtResult)
    console.log(`Сохранен debt_hash для ${tester2}:`, debtResult.debtHash)

    console.log(`✅ Долг на 150 RUB успешно получен пользователем ${tester2}`)
  })

  it(`берем ссуду создателю 250 RUB от tester3`, async () => {
    // Обновляем сегмент перед получением ссуды
    await sleep(1000)
    await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, tester3)
    const repaidAtDate = new Date()
    repaidAtDate.setDate(repaidAtDate.getDate() + 30)

    // Процессим полный цикл получения долга
    const debtResult = await processDebt(
      blockchain,
      'voskhod',
      tester3,
      componentProject.project_hash,
      '250.0000 RUB',
      fakeDocument,
      repaidAtDate,
    )

    // Сохраняем хэш долга для последующего использования
    userDebtHashes[tester3].push(debtResult.debtHash)

    // Проверяем что debt_amount увеличился на 250 RUB в сегменте
    expect(debtResult.segmentAfter.debt_amount).toBe('250.0000 RUB')

    // Проверяем что debt_amount увеличился у контрибьютора
    expect(debtResult.contributorAfter.debt_amount).toBe('250.0000 RUB')

    // Проверяем что долг перешел в статус 'paid' (готов к использованию/погашению)
    expect(debtResult.debtAfter.status).toBe('paid')

    console.log('debtResult tester3: ', debtResult)
    console.log(`Сохранен debt_hash для ${tester3}:`, debtResult.debtHash)

    console.log(`✅ Долг на 250 RUB успешно получен пользователем ${tester3}`)
  })

  it('начать голосование по проекту и проверить изменение статуса с active на voting', async () => {
    const data: CapitalContract.Actions.StartVoting.IStartVoting = {
      coopname: 'voskhod',
      project_hash: componentProject.project_hash,
    }

    const res = await processStartVoting(blockchain, data)
    expect(res.txStartId).toBeDefined()

    // Проверяем изменение статуса проекта с 'active' на 'voting'
    expect(res.projectBefore.status).toBe('active')
    expect(res.projectAfter.status).toBe('voting')

    // Проверяем что данные голосования инициализированы
    expect(res.projectAfter.voting.authors_voting_percent).toBeCloseTo(38.2, 10)
    expect(res.projectAfter.voting.creators_voting_percent).toBeCloseTo(38.2, 10)
    expect(res.projectAfter.voting.amounts.authors_equal_spread).toBe('49650.1200 RUB')
    expect(res.projectAfter.voting.amounts.creators_direct_spread).toBe('80340.0000 RUB')
    expect(res.projectAfter.voting.total_voters).toBe(3)
    expect(res.projectAfter.voting.votes_received).toBe(0)

    expect(parseFloat(res.projectAfter.fact.creators_bonus_pool)).toBeCloseTo(parseFloat(res.projectAfter.voting.amounts.creators_direct_spread) + parseFloat(res.projectAfter.voting.amounts.creators_bonuses_on_voting), 10)

    expect(parseFloat(res.projectAfter.fact.authors_bonus_pool)).toBeCloseTo(parseFloat(res.projectAfter.voting.amounts.authors_equal_spread) + parseFloat(res.projectAfter.voting.amounts.authors_bonuses_on_voting), 10)

    expect(res.projectAfter.voting.amounts.authors_equal_per_author).toBe('24825.0600 RUB')

    expect(parseFloat(res.projectAfter.voting.amounts.total_voting_pool)).toBeCloseTo(parseFloat(res.projectAfter.voting.amounts.creators_bonuses_on_voting) + parseFloat(res.projectAfter.voting.amounts.authors_bonuses_on_voting), 10)

    expect(res.projectAfter.voting.amounts.total_voting_pool).toBe('80349.8800 RUB')
    expect(res.projectAfter.voting.amounts.active_voting_amount).toBe('53566.5866 RUB')
  })

  it('голосовать аккаунтом tester1', async () => {
    const voters = [tester1, tester2, tester3]

    // Получаем текущий проект для получения active_voting_amount
    const currentProject = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      componentProject.project_hash,
      componentProject.project_hash,
      3,
      'sha256',
    ))[0]

    const votingAmount = currentProject.voting.amounts.active_voting_amount
    console.log('Голосующая сумма для распределения:', votingAmount)

    // Создаем список получателей - все кроме голосующего
    const recipients = voters.filter(v => v !== tester1)
    const voteDistribution = createVoteDistribution(recipients, tester1, votingAmount)

    const result = await submitVote(
      blockchain,
      'voskhod',
      tester1,
      componentProject.project_hash,
      voteDistribution,
    )

    // Проверяем что транзакция прошла успешно
    expect(result.txId).toBeDefined()

    // Проверяем увеличение количества голосов в проекте
    expect(result.projectAfter.voting.votes_received).toBe(result.projectBefore.voting.votes_received + 1)

    // Проверяем что новые голоса появились в таблице
    expect(result.votesAfter.length).toBe(result.votesBefore.length + 2)

    // Проверяем что у участника раньше не было голосов, а теперь есть
    expect(result.voterVotesBefore.length).toBe(0)
    expect(result.voterVotesAfter.length).toBe(2)

    console.log('VOTING RESULT tester1: ', result)

    // Проверяем что голоса соответствуют ожидаемому распределению
    result.voterVotesAfter.forEach((vote: any) => {
      expect(vote.voter).toBe(tester1)
      expect(vote.project_hash).toBe(componentProject.project_hash)
      const expectedVote = result.voteInput.find(v => v.recipient === vote.recipient)
      expect(expectedVote).toBeDefined()
      expect(vote.amount).toBe(expectedVote!.amount)
    })
  })

  it('голосовать аккаунтом tester2', async () => {
    const voters = [tester1, tester2, tester3]

    // Получаем текущий проект для получения active_voting_amount
    const currentProject = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      componentProject.project_hash,
      componentProject.project_hash,
      3,
      'sha256',
    ))[0]

    const votingAmount = currentProject.voting.amounts.active_voting_amount

    // Создаем список получателей - все кроме голосующего
    const recipients = voters.filter(v => v !== tester2)
    const voteDistribution = createVoteDistribution(recipients, tester2, votingAmount)

    const result = await submitVote(
      blockchain,
      'voskhod',
      tester2,
      componentProject.project_hash,
      voteDistribution,
    )
    console.log('VOTING RESULT tester2: ', result)
    expect(result.txId).toBeDefined()
    expect(result.projectAfter.voting.votes_received).toBe(result.projectBefore.voting.votes_received + 1)
    expect(result.votesAfter.length).toBe(result.votesBefore.length + 2)
    expect(result.voterVotesBefore.length).toBe(0)
    expect(result.voterVotesAfter.length).toBe(2)
  })

  it('голосовать аккаунтом tester3', async () => {
    const voters = [tester1, tester2, tester3]

    // Получаем текущий проект для получения active_voting_amount
    const currentProject = (await blockchain.getTableRows(
      CapitalContract.contractName.production,
      'voskhod',
      'projects',
      1,
      componentProject.project_hash,
      componentProject.project_hash,
      3,
      'sha256',
    ))[0]

    const votingAmount = currentProject.voting.amounts.active_voting_amount

    // Создаем список получателей - все кроме голосующего
    const recipients = voters.filter(v => v !== tester3)
    const voteDistribution = createVoteDistribution(recipients, tester3, votingAmount)

    const result = await submitVote(
      blockchain,
      'voskhod',
      tester3,
      componentProject.project_hash,
      voteDistribution,
    )

    console.log('VOTING RESULT tester3: ', result)

    expect(result.txId).toBeDefined()
    expect(result.projectAfter.voting.votes_received).toBe(result.projectBefore.voting.votes_received + 1)
    expect(result.votesAfter.length).toBe(result.votesBefore.length + 2)
    expect(result.voterVotesBefore.length).toBe(0)
    expect(result.voterVotesAfter.length).toBe(2)
  })

  it('завершаем голосование и проверяем изменение статуса проекта с voting на completed', async () => {
    const data: CapitalContract.Actions.CompleteVoting.ICompleteVoting = {
      coopname: 'voskhod',
      project_hash: componentProject.project_hash,
    }

    const result = await processCompleteVoting(blockchain, data)

    expect(result.txId).toBeDefined()
    expect(result.projectBefore.status).toBe('voting')
    expect(result.projectAfter.status).toBe('result')
  })

  it('рассчитываем голоса для участника tester1', async () => {
    const data: CapitalContract.Actions.CalculateVotes.IFinalVoting = {
      coopname: 'voskhod',
      username: tester1,
      project_hash: componentProject.project_hash,
    }

    const result = await processCalculateVotes(blockchain, data)
    expect(parseFloat(result.segmentAfter.voting_bonus)).toBeCloseTo(parseFloat(result.projectAfter.voting.amounts.equal_voting_amount), 2)
    expect(parseFloat(result.segmentAfter.voting_bonus)).toBeCloseTo(parseFloat(result.projectAfter.voting.amounts.total_voting_pool) / 3, 2)

    expect(result.txId).toBeDefined()
  })

  it('рассчитываем голоса для участника tester2', async () => {
    const data: CapitalContract.Actions.CalculateVotes.IFinalVoting = {
      coopname: 'voskhod',
      username: tester2,
      project_hash: componentProject.project_hash,
    }

    const result = await processCalculateVotes(blockchain, data)
    expect(parseFloat(result.segmentAfter.voting_bonus)).toBeCloseTo(parseFloat(result.projectAfter.voting.amounts.equal_voting_amount), 2)
    expect(parseFloat(result.segmentAfter.voting_bonus)).toBeCloseTo(parseFloat(result.projectAfter.voting.amounts.total_voting_pool) / 3, 2)

    expect(result.txId).toBeDefined()
  })

  it('рассчитываем голоса для участника tester3', async () => {
    const data: CapitalContract.Actions.CalculateVotes.IFinalVoting = {
      coopname: 'voskhod',
      username: tester3,
      project_hash: componentProject.project_hash,
    }

    const result = await processCalculateVotes(blockchain, data)
    expect(parseFloat(result.segmentAfter.voting_bonus)).toBeCloseTo(parseFloat(result.projectAfter.voting.amounts.equal_voting_amount), 2)
    expect(parseFloat(result.segmentAfter.voting_bonus)).toBeCloseTo(parseFloat(result.projectAfter.voting.amounts.total_voting_pool) / 3, 2)

    expect(result.txId).toBeDefined()
  })

  it('вносим результаты в кооператив для участников с интеллектуальными ролями', async () => {
    // Список участников с интеллектуальными ролями (Включая инвесторов, т.к. у них есть премии)
    const participantsWithIntellectualRoles = [tester1, tester2, tester3, tester4, tester5, investor1, investor2, investor3]

    for (const participant of participantsWithIntellectualRoles) {
      // Обновляем сегмент
      await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, participant)
      // Получаем сегмент участника для определения сумм
      const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, participant)

      // Взносим только интеллектуальную часть (премии + другие роли, без investor_base)
      const contributionAmount = segment.intellectual_cost
      const debtAmount = segment.debt_amount

      // Если интеллектуальный вклад нулевой и долга нет - пропускаем внесение результата
      if (parseFloat(contributionAmount.split(' ')[0]) === 0 && parseFloat(debtAmount.split(' ')[0]) === 0) {
        console.log(`⏩ Пропускаем внесение результата для ${participant} (интеллектуальный вклад и долг равны 0)`)
        continue
      }

      console.log(`Сегмент ${participant} до внесения результата:`, segment)
      console.log(`Сумма взноса: ${contributionAmount}, Сумма долга: ${debtAmount}`)
      console.log(`Хэши долгов для погашения:`, userDebtHashes[participant])

      const result = await processPushResult(
        blockchain,
        'voskhod',
        participant,
        componentProject.project_hash,
        contributionAmount,
        debtAmount,
        userDebtHashes[participant] || [], // Передаем вектор хэшей долгов
      )

      expect(result.transactionId).toBeDefined()
      expect(result.segmentBefore.status).toBe('ready')
      expect(result.segmentAfter.status).toBe('contributed')

      console.log(`✅ Результат внесен в кооператив для ${participant}`)
    }
  })

  it('конвертируем сегмент tester1 в главный кошелек и программу благороста', async () => {
    // Получаем сегмент tester1 для определения доступных сумм
    const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, tester1)
    console.log(`Сегмент tester1 перед конвертацией:`, segment)

    // Рассчитываем суммы для конвертации динамически
    const provisionalAmount = parseFloat(segment.provisional_amount.split(' ')[0])
    const debtAmount = parseFloat(segment.debt_amount.split(' ')[0])
    const availableForProgram = parseFloat(segment.available_for_program.split(' ')[0])
    const availableForWallet = parseFloat(segment.available_for_wallet.split(' ')[0])

    const walletAmountValue = availableForWallet
    const capitalAmountValue = availableForProgram - walletAmountValue

    const walletAmount = `${walletAmountValue.toFixed(4)} RUB`
    const capitalAmount = `${capitalAmountValue.toFixed(4)} RUB`
    const projectAmount = '0.0000 RUB'

    console.log(`Конвертация tester1: кошелек=${walletAmount}, капитализация=${capitalAmount}, проект=${projectAmount}`)

    totalToCapitalConvertAmount += parseFloat(capitalAmount.split(' ')[0])
    totalToProjectConvertAmount += parseFloat(projectAmount.split(' ')[0])
    const result = await processConvertSegment(
      blockchain,
      'voskhod',
      tester1,
      componentProject.project_hash,
      walletAmount,
      capitalAmount,
      projectAmount,
    )

    expect(result.transactionId).toBeDefined()
    expect(result.segmentBefore.status === 'contributed' || result.segmentBefore.status === 'skipped').toBe(true)
    expect(result.segmentAfter).toBeUndefined()

    console.log(`✅ Сегмент ${tester1} конвертирован`)
  })

  it('конвертируем сегмент tester2 в программу благороста', async () => {
    // Получаем сегмент tester2 для определения доступных сумм
    const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, tester2)
    console.log(`Сегмент tester2 перед конвертацией:`, segment)

    // Конвертируем все доступные средства в благорост
    const availableAmount = parseFloat(segment.available_for_program.split(' ')[0])
    const walletAmount = '0.0000 RUB'
    const capitalAmount = `${availableAmount.toFixed(4)} RUB`
    const projectAmount = '0.0000 RUB'

    totalToCapitalConvertAmount += parseFloat(capitalAmount.split(' ')[0])
    totalToProjectConvertAmount += parseFloat(projectAmount.split(' ')[0])
    console.log(`Конвертация tester2: в программу благороста=${capitalAmount}`)

    const result = await processConvertSegment(
      blockchain,
      'voskhod',
      tester2,
      componentProject.project_hash,
      walletAmount,
      capitalAmount,
      projectAmount,
    )

    expect(result.transactionId).toBeDefined()
    expect(result.segmentBefore.status === 'contributed' || result.segmentBefore.status === 'skipped').toBe(true)
    expect(result.segmentAfter).toBeUndefined()

    console.log(`✅ Сегмент ${tester2} конвертирован в благорост`)
  })

  it('конвертируем сегмент tester3 в благорост', async () => {
    // Получаем сегмент tester3 для определения доступных сумм
    const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, tester3)
    console.log(`Сегмент tester3 перед конвертацией:`, segment)

    // Конвертируем все доступные средства в благорост
    const availableAmount = parseFloat(segment.available_for_program.split(' ')[0])
    const walletAmount = '0.0000 RUB'
    const capitalAmount = `${availableAmount.toFixed(4)} RUB`
    const projectAmount = '0.0000 RUB'

    console.log(`Конвертация tester3: только в благорост=${capitalAmount}`)

    totalToCapitalConvertAmount += parseFloat(capitalAmount.split(' ')[0])
    totalToProjectConvertAmount += parseFloat(projectAmount.split(' ')[0])
    const result = await processConvertSegment(
      blockchain,
      'voskhod',
      tester3,
      componentProject.project_hash,
      walletAmount,
      capitalAmount,
      projectAmount,
    )

    expect(result.transactionId).toBeDefined()
    expect(result.segmentBefore.status === 'contributed' || result.segmentBefore.status === 'skipped').toBe(true)
    expect(result.segmentAfter).toBeUndefined()

    console.log(`✅ Сегмент ${tester3} конвертирован в благорост`)
  })

  it('конвертируем сегмент tester4 в благорост', async () => {
    // Получаем сегмент tester4 для определения доступных сумм
    const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, tester4)
    console.log(`Сегмент tester4 перед конвертацией:`, segment)

    // Конвертируем в разные направления
    const availableAmount = parseFloat(segment.available_for_program.split(' ')[0])
    const walletAmount = '0.0000 RUB'
    const capitalAmount = `${availableAmount.toFixed(4)} RUB`
    const projectAmount = '0.0000 RUB'

    console.log(`Конвертация tester4: кошелек=${walletAmount}, капитализация=${capitalAmount}, проект=${projectAmount}`)

    totalToCapitalConvertAmount += parseFloat(capitalAmount.split(' ')[0])
    totalToProjectConvertAmount += parseFloat(projectAmount.split(' ')[0])
    const result = await processConvertSegment(
      blockchain,
      'voskhod',
      tester4,
      componentProject.project_hash,
      walletAmount,
      capitalAmount,
      projectAmount,
    )

    expect(result.transactionId).toBeDefined()
    expect(result.segmentBefore.status === 'contributed' || result.segmentBefore.status === 'skipped').toBe(true)
    expect(result.segmentAfter).toBeUndefined()

    console.log(`✅ Сегмент ${tester4} конвертирован в смешанные направления`)
  })

  it('конвертируем сегмент tester5 в благорост', async () => {
    // Получаем сегмент tester5 для определения доступных сумм
    const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, tester5)
    console.log(`Сегмент tester5 перед конвертацией:`, segment)

    // Конвертируем все доступные средства в благорост
    const availableAmount = parseFloat(segment.available_for_program.split(' ')[0])
    const walletAmount = '0.0000 RUB'
    const capitalAmount = `${availableAmount.toFixed(4)} RUB`
    const projectAmount = '0.0000 RUB'

    console.log(`Конвертация tester5: кошелек=${walletAmount}, капитализация=${capitalAmount}, проект=${projectAmount}`)

    totalToCapitalConvertAmount += parseFloat(capitalAmount.split(' ')[0])
    totalToProjectConvertAmount += parseFloat(projectAmount.split(' ')[0])
    const result = await processConvertSegment(
      blockchain,
      'voskhod',
      tester5,
      componentProject.project_hash,
      walletAmount,
      capitalAmount,
      projectAmount,
    )

    expect(result.transactionId).toBeDefined()
    expect(result.segmentBefore.status === 'contributed' || result.segmentBefore.status === 'skipped').toBe(true)
    expect(result.segmentAfter).toBeUndefined()

    console.log(`✅ Сегмент ${tester5} конвертирован в благорост`)
  })

  it('конвертируем сегмент investor1 в благорост', async () => {
    await sleep(500)
    // Обновляем сегмент инвестора перед конвертацией
    await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, investor1)

    // Получаем сегмент investor1 для определения доступных сумм
    const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, investor1)
    console.log(`Сегмент investor1 перед конвертацией:`, segment)

    // Конвертируем все доступные средства в благорост
    const availableAmount = parseFloat(segment.available_for_program.split(' ')[0])
    const walletAmount = '0.0000 RUB'
    const capitalAmount = `${availableAmount.toFixed(4)} RUB`
    const projectAmount = '0.0000 RUB'

    console.log(`Конвертация investor1: кошелек=${walletAmount}, капитализация=${capitalAmount}, проект=${projectAmount}`)

    totalToCapitalConvertAmount += parseFloat(capitalAmount.split(' ')[0])
    totalToProjectConvertAmount += parseFloat(projectAmount.split(' ')[0])
    const result = await processConvertSegment(
      blockchain,
      'voskhod',
      investor1,
      componentProject.project_hash,
      walletAmount,
      capitalAmount,
      projectAmount,
    )

    expect(result.transactionId).toBeDefined()
    expect(result.segmentBefore.status === 'contributed' || result.segmentBefore.status === 'skipped').toBe(true)
    expect(result.segmentAfter).toBeUndefined()

    console.log(`✅ Сегмент ${investor1} конвертирован в благорост`)
  })

  it('конвертируем сегмент investor2', async () => {
    await sleep(500)
    // Обновляем сегмент инвестора перед конвертацией
    await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, investor2)

    // Получаем сегмент investor2 для определения доступных сумм
    const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, investor2)
    console.log(`Сегмент investor2 перед обработкой:`, segment)

    if (segment.status === 'skipped') {
      console.log(`⏩ Сегмент ${investor2} пропущен (skipped), очищаем через purgesegment`)
      const result = await blockchain.api.transact({
        actions: [{
          account: CapitalContract.contractName.production,
          name: 'purgesegment',
          authorization: [{ actor: 'voskhod', permission: 'active' }],
          data: {
            coopname: 'voskhod',
            username: investor2,
            project_hash: componentProject.project_hash,
          },
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
      expect(result.transaction_id).toBeDefined()
    }
    else {
      // Конвертируем все доступные средства в благорост
      const availableAmount = parseFloat(segment.available_for_program.split(' ')[0])
      const walletAmount = '0.0000 RUB'
      const capitalAmount = `${availableAmount.toFixed(4)} RUB`
      const projectAmount = '0.0000 RUB'

      console.log(`Конвертация investor2: кошелек=${walletAmount}, капитализация=${capitalAmount}, проект=${projectAmount}`)

      totalToCapitalConvertAmount += parseFloat(capitalAmount.split(' ')[0])
      totalToProjectConvertAmount += parseFloat(projectAmount.split(' ')[0])
      const result = await processConvertSegment(
        blockchain,
        'voskhod',
        investor2,
        componentProject.project_hash,
        walletAmount,
        capitalAmount,
        projectAmount,
      )
      expect(result.transactionId).toBeDefined()
    }

    console.log(`✅ Сегмент ${investor2} обработан`)
  })

  it('конвертируем сегмент investor3', async () => {
    await sleep(500)
    // Обновляем сегмент инвестора перед конвертацией
    await refreshSegment(blockchain, 'voskhod', componentProject.project_hash, investor3)

    // Получаем сегмент investor3 для определения доступных сумм
    const segment = await getSegment(blockchain, 'voskhod', componentProject.project_hash, investor3)
    console.log(`Сегмент investor3 перед обработкой:`, segment)

    if (segment.status === 'skipped') {
      console.log(`⏩ Сегмент ${investor3} пропущен (skipped), очищаем через purgesegment`)
      const result = await blockchain.api.transact({
        actions: [{
          account: CapitalContract.contractName.production,
          name: 'purgesegment',
          authorization: [{ actor: 'voskhod', permission: 'active' }],
          data: {
            coopname: 'voskhod',
            username: investor3,
            project_hash: componentProject.project_hash,
          },
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
      expect(result.transaction_id).toBeDefined()
    }
    else {
      // Конвертируем все доступные средства в благорост
      const availableAmount = parseFloat(segment.available_for_program.split(' ')[0])
      const walletAmount = '0.0000 RUB'
      const capitalAmount = `${availableAmount.toFixed(4)} RUB`
      const projectAmount = '0.0000 RUB'

      console.log(`Конвертация investor3: кошелек=${walletAmount}, капитализация=${capitalAmount}, проект=${projectAmount}`)

      totalToCapitalConvertAmount += parseFloat(capitalAmount.split(' ')[0])
      totalToProjectConvertAmount += parseFloat(projectAmount.split(' ')[0])
      const result = await processConvertSegment(
        blockchain,
        'voskhod',
        investor3,
        componentProject.project_hash,
        walletAmount,
        capitalAmount,
        projectAmount,
      )
      expect(result.transactionId).toBeDefined()
    }

    console.log(`✅ Сегмент ${investor3} обработан`)
  })

  it('инвариант: w.cap.gncom (ЦПП «Генератор» — коммит) не уходит в дефицит после конвертации всех сегментов', async () => {
    // Σ COMMIT_RID(коммитов проекта) = Σ commit.amounts.total_contribution
    // должна быть >= Σ ACCEPT_RID(сегментов) = Σ segment.available_for_program.
    //
    // Эквивалентность (delta == 0) выполняется только когда **все** participants
    // прошли полный цикл pushResult+signact2 без skipped/purge и contributors_bonus_pool
    // распределился по всем ролям. В сложных тестах (как этот) есть пограничные
    // ситуации: investor3 со статусом 'skipped' → purgesegment без convertsegm,
    // тестеры с is_contributor=0 не получают свою долю contributors_bonus.
    // Их непокрытая часть остаётся на w.cap.gncom как избыток — это ожидаемо.
    //
    // **Жёсткий инвариант** — отсутствие дефицита (delta >= 0). Если он
    // нарушен, значит approvecmmt кладёт на w.cap.gncom меньше, чем signact2
    // забирает — это регрессия патча approvecmmt, и в проде на signact2
    // последнего пайщика проекта возникает «недостаточно средств на кошельке
    // w.cap.gncom». Защищает от ровно того бага, который ловили
    // 2026-04-27 (delta_available вместо total_contribution).
    const wallets = await blockchain.getTableRows('ledger2', 'voskhod', 'wallets', 500) as Array<{ id: string, available: string, blocked: string }>
    const generator = wallets.find((w) => String(w.id) === WALLET_GENERATOR_COMMIT)
    expect(generator, `wallet ${WALLET_GENERATOR_COMMIT} должен существовать`).toBeDefined()

    const generatorTotalRub = parseFloat(generator!.available.split(' ')[0]) + parseFloat(generator!.blocked.split(' ')[0])
    const generatorDelta = generatorTotalRub - generatorCommitBaselineRub
    console.log(`🔍 ${WALLET_GENERATOR_COMMIT}: baseline=${generatorCommitBaselineRub} now=${generatorTotalRub} delta=${generatorDelta}`)
    expect(generatorDelta, `${WALLET_GENERATOR_COMMIT} ушёл в дефицит (Σ COMMIT_RID < Σ ACCEPT_RID для проекта ${componentProject.project_hash.slice(0, 12)}…) — регрессия approvecmmt?`).toBeGreaterThanOrEqual(-0.0001)

    if (generatorDelta > 0.0001) {
      console.log(`⚠️  ${WALLET_GENERATOR_COMMIT} остаток ${generatorDelta.toFixed(4)} RUB — это нераспределённые доли (skipped-сегменты, роли без is_contributor); ожидаемо для этого сценария.`)
    }

    // Дополнительно: w.cap.bgrid (BLAGOROST_RID) должен получить хоть какие-то
    // средства (в проекте есть intellectual contribution, и хоть один сегмент
    // дошёл до signact2). Точная сверка с total_contribution невозможна:
    // signact2 параллельно вызывает REPAY (LOAN_ISSUED → SHARE_FUND_PAY)
    // на debt_amount, который не идёт на w.cap.bgrid. Поэтому только sanity-чек,
    // что путь ACCEPT_RID(w.cap.gncom → w.cap.bgrid) вообще работает.
    const project = await getProject(blockchain, 'voskhod', componentProject.project_hash)
    const blagorost = wallets.find((w) => String(w.id) === WALLET_BLAGOROST_RID)
    const blagorostTotalRub = blagorost
      ? parseFloat(blagorost.available.split(' ')[0]) + parseFloat(blagorost.blocked.split(' ')[0])
      : 0
    const blagorostDelta = blagorostTotalRub - blagorostRidBaselineRub
    const expectedTotalContribution = parseFloat(String(project.fact.total_contribution).split(' ')[0])
    console.log(`🔍 ${WALLET_BLAGOROST_RID} delta=${blagorostDelta}, project.fact.total_contribution=${expectedTotalContribution}`)
    expect(blagorostDelta, `${WALLET_BLAGOROST_RID} не получил никаких средств — путь ACCEPT_RID не работает`).toBeGreaterThan(0)
  })

  it('удаляем компонент-проект', async () => {
    const result = await processDeleteProject(blockchain, 'voskhod', componentProject.project_hash)

    expect(result.transactionId).toBeDefined()
    expect(result.projectBefore).toBeDefined()
    expect(result.projectAfter).toBeNull() // Проект должен быть удален

    console.log(`✅ Компонент-проект удален: ${componentProject.project_hash}`)
  })

  it('создаём новый компонент-проект', async () => {
    const newComponentHash = generateRandomSHA256()

    const newComponentData: CapitalContract.Actions.CreateProject.ICreateProject = {
      coopname: 'voskhod',
      project_hash: newComponentHash,
      parent_hash: metaProject.project_hash, // Родительский хэш указывает на мета-проект
      title: `Новый компонент-проект ${newComponentHash.slice(0, 10)}`,
      description: generateRandomDescription(),
      meta: generateRandomMeta(),
      invite: '',
      data: generateRandomProjectData(1200, 3000),
    }

    newComponentProject = newComponentData

    const result = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.CreateProject.actionName,
            authorization: [
              {
                actor: 'voskhod',
                permission: 'active',
              },
            ],
            data: newComponentData,
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      },
    )

    expect(result.transaction_id).toBeDefined()
    getTotalRamUsage(result)

    console.log(`✅ Создан новый компонент-проект: ${newComponentProject.project_hash}`)
  })

  it('подписываем новое приложение к договору УХД со множеством участников', async () => {
    // NOTE: apprvappndx больше НЕ вызывает regshare inline (коммит [562-13]
    // da8c4436255): допуск к проекту и регистрация доли разведены.
    // После приёма приложения participant имеет project_hash в appendixes,
    // но сегмента в проекте ещё нет — его создаст отдельный regshare
    // (следующий спек).
    const testerNames = [tester1, tester2, tester3, tester4, tester5, investor1, investor2, investor3]
    for (const tester of testerNames) {
      const appendixHash = generateRandomSHA256()

      await signAppendix(blockchain, 'voskhod', tester, newComponentProject.project_hash, appendixHash)
      const contributor = (await blockchain.getTableRows(
        CapitalContract.contractName.production,
        'voskhod',
        'contributors',
        1,
        tester,
        tester,
        2,
        'i64',
      ))[0]
      expect(contributor).toBeDefined()
      expect(contributor.appendixes).toContain(componentProject.project_hash)
      expect(contributor.status).toBe('active')
    }
  }, 1000_000)

  it('регистрируем доли вкладчиков через capital::regshare отдельным действием', async () => {
    // regshare теперь отдельное действие кооператива (см. signAppendix-спек выше).
    // Кооп вызывает regshare после того, как participant подписал appendix к
    // проекту: передаёт user_shares = баланс в целевой программе «Благорост»
    // (available + blocked). Сегмент создаётся (или обновляется) с is_contributor=1.
    const allParticipants = [tester1, tester2, tester3, tester4, tester5, investor1, investor2, investor3]

    console.log('\n=== ДИАГНОСТИКА: Проверка балансов благороста и сегментов ===\n')

    let totalCapitalBalances = 0
    const participantsWithCapital: { name: string, balance: string, amount: number }[] = []

    // Собираем всех participants с ненулевым балансом Благороста.
    for (const participant of allParticipants) {
      const capitalWallet = await getUserProgramWalletAmount(blockchain, 'voskhod', participant, capitalProgramId)
      const capitalAmount = parseFloat(capitalWallet.split(' ')[0])

      console.log(`${participant}: баланс Благороста = ${capitalWallet}`)

      if (capitalAmount > 0) {
        totalCapitalBalances += capitalAmount
        participantsWithCapital.push({ name: participant, balance: capitalWallet, amount: capitalAmount })
      }
    }

    // Регистрируем долю каждого вкладчика отдельным regshare-действием.
    // (investor2 тоже имеет баланс в _capital_program — средства идут туда
    // напрямую при инвестировании; итого — 8 вкладчиков.)
    console.log('\n=== РЕГИСТРАЦИЯ ДОЛЕЙ (capital::regshare) ===\n')
    for (const p of participantsWithCapital) {
      await processRegShare(blockchain, 'voskhod', newComponentProject.project_hash, p.name, p.balance)
      console.log(`regshare ${p.name}: ${p.balance}`)
    }

    // После regshare сегменты должны существовать и отражать баланс 1:1.
    let totalRegisteredInProject = 0
    for (const p of participantsWithCapital) {
      const segment = await getSegment(blockchain, 'voskhod', newComponentProject.project_hash, p.name)
      expect(segment, `Сегмент ${p.name} должен быть создан после regshare`).toBeDefined()
      expect(segment.is_contributor, `${p.name}.is_contributor`).toBe(1)
      expect(segment.capital_contributor_shares, `${p.name}.capital_contributor_shares`).toBe(p.balance)

      const segmentCapital = parseFloat(segment.capital_contributor_shares.split(' ')[0])
      totalRegisteredInProject += segmentCapital
    }

    const projectState = await getProject(blockchain, 'voskhod', newComponentProject.project_hash)
    const projectTotal = parseFloat(projectState.crps.total_capital_contributors_shares.split(' ')[0])

    console.log('\n=== ИТОГОВЫЕ СУММЫ ===')
    console.log(`Участники с балансом благороста: ${participantsWithCapital.map(p => p.name).join(', ')}`)
    console.log(`Сумма балансов в программе благороста: ${totalCapitalBalances.toFixed(4)} RUB`)
    console.log(`Сумма в сегментах проекта: ${totalRegisteredInProject.toFixed(4)} RUB`)
    console.log(`total_capital_contributors_shares: ${projectState.crps.total_capital_contributors_shares}`)

    // Инварианты CRPS: сумма долей в сегментах = баланс благороста;
    // total_capital_contributors_shares проекта = то же значение.
    expect(totalRegisteredInProject).toBeCloseTo(totalCapitalBalances, 4)
    expect(projectTotal).toBeCloseTo(totalCapitalBalances, 4)
    expect(participantsWithCapital.length).toBe(8)

    console.log(`✅ ${participantsWithCapital.length} вкладчиков зарегистрированы через regshare, общая доля: ${projectTotal.toFixed(4)} RUB`)
  }, 300_000)

  it('regshare идемпотентен: повторный вызов обновляет user_shares', async () => {
    // regshare.cpp: если сегмент существует — обновляется (upsert). Повторный
    // вызов с тем же значением не должен ломать инварианты; с другим значением —
    // обновляет capital_contributor_shares в сегменте и суммарно в проекте.
    const participant = tester1
    const walletBefore = await getUserProgramWalletAmount(blockchain, 'voskhod', participant, capitalProgramId)
    const segmentBefore = await getSegment(blockchain, 'voskhod', newComponentProject.project_hash, participant)
    expect(segmentBefore.capital_contributor_shares).toBe(walletBefore)

    // Повторный regshare с тем же балансом — должен пройти без ошибок
    // (upsert_contributor_segment перезаписывает значение).
    // Спим, чтобы expiration новой транзакции отличался — иначе она получит
    // тот же tx_hash и узел отклонит как duplicate transaction.
    await sleep(2000)
    await processRegShare(blockchain, 'voskhod', newComponentProject.project_hash, participant, walletBefore)

    const segmentAfter = await getSegment(blockchain, 'voskhod', newComponentProject.project_hash, participant)
    expect(segmentAfter.capital_contributor_shares).toBe(walletBefore)
    expect(segmentAfter.is_contributor).toBe(1)
    console.log(`✅ Повторный regshare идемпотентен: ${segmentAfter.capital_contributor_shares}`)
  }, 60_000)

  it.skip('проверяем что повторная регистрация вкладчика невозможна', async () => {
    await sleep(1000)
    // NOTE: Тест пропущен - ручная регистрация через processAddContributor больше не используется
    // Регистрация теперь происходит автоматически при одобрении допуска председателем
    console.log('Тест пропущен: ручная регистрация через processAddContributor больше не используется')
  })

  it('добавляем мастера к новому проекту', async () => {
    const data: CapitalContract.Actions.SetMaster.ISetMaster = {
      coopname: 'voskhod',
      project_hash: newComponentProject.project_hash,
      master: tester1,
    }

    const result = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.SetMaster.actionName,
            authorization: [
              {
                actor: 'voskhod',
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

    const project = await getProject(blockchain, 'voskhod', newComponentProject.project_hash)
    expect(project.master).toBe(tester1)

    const segment = await getSegment(blockchain, 'voskhod', newComponentProject.project_hash, tester1)
    expect(segment.is_author).toBe(1)
  })

  it('устанавливаем план нового проекта', async () => {
    const data: CapitalContract.Actions.SetPlan.ISetPlan = {
      coopname: 'voskhod',
      master: tester1,
      project_hash: newComponentProject.project_hash,
      plan_creators_hours: 50,
      plan_expenses: '5000.0000 RUB',
      plan_hour_cost: '1000.0000 RUB',
    }

    const result = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.SetPlan.actionName,
            authorization: [
              {
                actor: 'voskhod',
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
  })

  it('стартуем новый проект', async () => {
    const data: CapitalContract.Actions.StartProject.IStartProject = {
      coopname: 'voskhod',
      project_hash: newComponentProject.project_hash,
    }
    const tx = await blockchain.api.transact(
      {
        actions: [
          {
            account: CapitalContract.contractName.production,
            name: CapitalContract.Actions.StartProject.actionName,
            authorization: [{ actor: 'voskhod', permission: 'active' }],
            data,
          },
        ],
      },
      { blocksBehind: 3, expireSeconds: 30 },
    )
    getTotalRamUsage(tx)
    expect(tx.transaction_id).toBeDefined()
  })

  it('cRPS алгоритм: точная проверка распределения премий вкладчиков', async () => {
    console.log('\n=== ДИАГНОСТИКА cRPS: Начальное состояние проекта ===\n')

    const allParticipants = [tester1, tester2, tester3, tester4, tester5, investor1, investor2, investor3]

    // Собираем информацию о всех участниках с балансом благороста
    const contributorsInfo = []
    let totalCapitalInProject = 0

    for (const participant of allParticipants) {
      try {
        const segment = await getSegment(blockchain, 'voskhod', newComponentProject.project_hash, participant)
        if (segment && segment.is_contributor) {
          const capitalShares = parseFloat(segment.capital_contributor_shares.split(' ')[0])
          totalCapitalInProject += capitalShares
          contributorsInfo.push({
            name: participant,
            capitalShares,
            contributorBonus: segment.contributor_bonus,
          })
          console.log(`${participant}: capital_shares=${segment.capital_contributor_shares}, contributor_bonus=${segment.contributor_bonus}`)
        }
      }
      catch (error) {
        // Участник не в проекте
      }
    }

    console.log(`\nВсего вкладчиков в проекте: ${contributorsInfo.length}`)
    console.log(`Общая сумма благороста: ${totalCapitalInProject.toFixed(4)} RUB`)

    const projectBefore = await getProject(blockchain, 'voskhod', newComponentProject.project_hash)
    console.log(`total_capital_contributors_shares из проекта: ${projectBefore.crps.total_capital_contributors_shares}`)
    console.log(`contributors_bonus_pool: ${projectBefore.fact.contributors_bonus_pool}`)

    // Делаем коммит от tester1
    console.log('\n=== Коммит от tester1 (10 часов) ===\n')
    const commitResult1 = await commitToResult(blockchain, 'voskhod', newComponentProject.project_hash, tester1, 10)

    console.log(`Новый contributors_bonus_pool: ${commitResult1.finalProject.fact.contributors_bonus_pool}`)

    // Проверяем распределение премий между всеми вкладчиками
    console.log('\n=== Распределение премий после коммита ===\n')
    let totalBonuses = 0

    for (const info of contributorsInfo) {
      const segment = await refreshSegment(blockchain, 'voskhod', newComponentProject.project_hash, info.name)
      const bonus = parseFloat(segment.updatedSegment.contributor_bonus.split(' ')[0])
      totalBonuses += bonus

      const share = (info.capitalShares / totalCapitalInProject * 100).toFixed(2)
      console.log(`${info.name}:`)
      console.log(`  - Доля благороста: ${info.capitalShares.toFixed(4)} RUB (${share}%)`)
      console.log(`  - Премия вкладчика: ${segment.updatedSegment.contributor_bonus}`)
    }

    console.log(`\nОбщая сумма премий вкладчиков: ${totalBonuses.toFixed(4)} RUB`)
    const bonusPool = parseFloat(commitResult1.finalProject.fact.contributors_bonus_pool.split(' ')[0])
    console.log(`Пул премий в проекте: ${commitResult1.finalProject.fact.contributors_bonus_pool}`)

    // Проверяем точное распределение премий
    // (investor2 теперь тоже вкладчик т.к. средства идут в _capital_program напрямую при инвестировании)
    expect(contributorsInfo.length).toBe(8) // 8 вкладчиков зарегистрированы
    expect(totalBonuses).toBeCloseTo(19998.48, 2) // Общая сумма премий
    expect(bonusPool).toBeCloseTo(19998.48, 2) // Пул премий в проекте
    expect(totalCapitalInProject).toBeCloseTo(768285.4189, 3) // Общая капитализация

    console.log(`✅ Премии ${totalBonuses.toFixed(4)} RUB корректно распределены между ${contributorsInfo.length} вкладчиками пропорционально их долям`)
  })

  it('тестирование распределения членских взносов в программе благороста', async () => {
    const fundAmount = '10000.0000 RUB'

    // Финансирование программы благороста
    const fundResult = await processFundProgram(
      blockchain,
      'voskhod',
      fundAmount,
      'Тестовое финансирование программы благороста',
    )

    expect(fundResult.transactionId).toBeDefined()
    expect(fundResult.programWalletBefore).toBeDefined()
    expect(fundResult.programWalletAfter).toBeDefined()

    console.log('✅ Финансирование программы благороста выполнено успешно')

    // Обновление CRPS для одного из пользователей (tester1)
    const refreshResult = await processRefreshProg(
      blockchain,
      'voskhod',
      tester1,
    )

    expect(refreshResult.transactionId).toBeDefined()
    expect(refreshResult.programWalletBefore).toBeDefined()
    expect(refreshResult.programWalletAfter).toBeDefined()

    console.log('✅ Обновление CRPS в программе благороста выполнено успешно')
  })

  /// ////////// FINISH

  // it('быстрое голосование в новом проекте', async () => {
  //   // Стартуем голосование
  //   const startResult = await processStartVoting(blockchain, {
  //     coopname: 'voskhod',
  //     project_hash: newComponentProject.project_hash,
  //   })
  //   expect(startResult.projectAfter.status).toBe('voting')

  //   // Голосуем - каждый голосует за всех, кроме себя
  //   const voters = [tester1, tester3]
  //   for (const voter of voters) {
  //     const currentProject = (await blockchain.getTableRows(
  //       CapitalContract.contractName.production,
  //       'voskhod',
  //       'projects',
  //       1,
  //       newComponentProject.project_hash,
  //       newComponentProject.project_hash,
  //       3,
  //       'sha256',
  //     ))[0]

  //     const votingAmount = currentProject.voting.amounts.active_voting_amount
  //     // Создаем список получателей - все кроме голосующего
  //     const recipients = voters.filter(v => v !== voter)
  //     const voteDistribution = createVoteDistribution(recipients, voter, votingAmount)

  //     await submitVote(blockchain, 'voskhod', voter, newComponentProject.project_hash, voteDistribution)
  //   }

  //   // Завершаем голосование
  //   const completeResult = await processCompleteVoting(blockchain, {
  //     coopname: 'voskhod',
  //     project_hash: newComponentProject.project_hash,
  //   })
  //   expect(completeResult.projectAfter.status).toBe('completed')

  //   // Рассчитываем голоса
  //   for (const voter of voters) {
  //     await processCalculateVotes(blockchain, {
  //       coopname: 'voskhod',
  //       username: voter,
  //       project_hash: newComponentProject.project_hash,
  //     })
  //   }
  // })

  // it('вносим результаты в кооператив для нового проекта', async () => {
  //   const voters = [tester1, tester3]

  //   for (const voter of voters) {
  //     const segment = await getSegment(blockchain, 'voskhod', newComponentProject.project_hash, voter)
  //     const contributionAmount = segment.total_segment_cost
  //     const debtAmount = '0.0000 RUB' // В новом проекте долгов нет

  //     const result = await processPushResult(
  //       blockchain,
  //       'voskhod',
  //       voter,
  //       newComponentProject.project_hash,
  //       contributionAmount,
  //       debtAmount,
  //       [], // Нет долгов для погашения
  //     )

  //     expect(result.transactionId).toBeDefined()
  //     expect(result.segmentAfter.status).toBe('accepted')
  //   }
  // })

  // it('проверяем что проектные взносы нового проекта идут в мета-проект', async () => {
  //   // Получаем состояние мета-проекта до конвертации
  //   const metaProjectBefore = (await blockchain.getTableRows(
  //     CapitalContract.contractName.production,
  //     'voskhod',
  //     'projects',
  //     1,
  //     metaProject.project_hash,
  //     metaProject.project_hash,
  //     3,
  //     'sha256',
  //   ))[0]

  //   // Конвертируем один из сегментов в проект
  //   const segment = await getSegment(blockchain, 'voskhod', newComponentProject.project_hash, tester1)
  //   const availableAmount = parseFloat(segment.total_segment_cost.split(' ')[0])

  //   await processConvertSegment(
  //     blockchain,
  //     'voskhod',
  //     tester1,
  //     newComponentProject.project_hash,
  //     '0.0000 RUB',
  //     '0.0000 RUB',
  //     `${availableAmount.toFixed(4)} RUB`, // Всё в проект
  //   )

  //   // Получаем состояние мета-проекта после конвертации
  //   const metaProjectAfter = (await blockchain.getTableRows(
  //     CapitalContract.contractName.production,
  //     'voskhod',
  //     'projects',
  //     1,
  //     metaProject.project_hash,
  //     metaProject.project_hash,
  //     3,
  //     'sha256',
  //   ))[0]

  //   // Проверяем что мета-проект получил дополнительные средства
  //   const beforeContributors = parseFloat(metaProjectBefore.fact.contributors_pool.split(' ')[0])
  //   const afterContributors = parseFloat(metaProjectAfter.fact.contributors_pool.split(' ')[0])
  //   expect(afterContributors).toBeGreaterThan(beforeContributors)

  //   console.log(`✅ Мета-проект получил дополнительные взносы: ${beforeContributors} → ${afterContributors}`)
  // })

  // it('конвертируем все остальные сегменты перед удалением проекта', async () => {
  //   // Конвертируем оставшиеся сегменты всех участников
  //   const remainingParticipants = [tester3, tester4] // tester1 уже сконвертирован выше

  //   for (const participant of remainingParticipants) {
  //     const segment = await getSegment(blockchain, 'voskhod', newComponentProject.project_hash, participant)
  //     const availableAmount = parseFloat(segment.total_segment_cost.split(' ')[0])

  //     if (availableAmount > 0) {
  //       // Конвертируем в благорост
  //       await processConvertSegment(
  //         blockchain,
  //         'voskhod',
  //         participant,
  //         newComponentProject.project_hash,
  //         '0.0000 RUB',
  //         `${availableAmount.toFixed(4)} RUB`, // В благорост
  //         '0.0000 RUB',
  //       )
  //       console.log(`✅ Сегмент ${participant} конвертирован в благорост`)
  //     }
  //   }
  // })

  // it('финальное удаление нового компонент-проекта', async () => {
  //   const result = await processDeleteProject(blockchain, 'voskhod', newComponentProject.project_hash)

  //   expect(result.transactionId).toBeDefined()
  //   expect(result.projectBefore).toBeDefined()
  //   expect(result.projectAfter).toBeNull() // Проект должен быть удален

  //   console.log(`✅ Новый компонент-проект удален: ${newComponentProject.project_hash}`)
  //   console.log(`✅ Тестирование мета-проектов и компонент-проектов завершено`)
  // })

  it('тест ВЫСОКОЙ ТОЧНОСТИ: 1 млрд инвестиций и 10к часов', async () => {
    await sleep(1000)
    console.log('\n🚀 СТАРТ ТЕСТА ВЫСОКОЙ ТОЧНОСТИ (50M RUB) 🚀\n')
    const auditHistory: any[] = []
    const this_investor = investor3

    // 6. Инвестиция 100 000 000 000 RUB
    const largeInvestAmount = 1000000000

    const auditParticipants = async (title: string, hash: string) => {
      const auditMap = { tester1, tester2, this_investor, tester5 }
      const proj = await getProject(blockchain, 'voskhod', hash)
      const pools = proj.fact

      for (const [key, username] of Object.entries(auditMap)) {
        const wallet = await getUserProgramWalletAmount(blockchain, 'voskhod', username, capitalProgramId)
        const seg = await getSegment(blockchain, 'voskhod', hash, username)
        auditHistory.push({
          'ЭТАП': title,
          'var': key,
          'user': username,
          'Благорост': wallet,
          ...seg,
          '---': '|',
          'P_AB': pools.authors_base_pool,
          'P_CB': pools.creators_base_pool,
          'P_ABon': pools.authors_bonus_pool,
          'P_CBon': pools.creators_bonus_pool,
          'P_Inv': pools.invest_pool,
          'P_Coord': pools.coordinators_base_pool,
          'P_ContrB': pools.contributors_bonus_pool,
          'P_Total': pools.total,
        })
      }
    }
    // 1. Создаем новый проект
    const highPrecisionHash = generateRandomSHA256()
    const projectData: CapitalContract.Actions.CreateProject.ICreateProject = {
      coopname: 'voskhod',
      project_hash: highPrecisionHash,
      parent_hash: metaProject.project_hash,
      title: `High Precision 50kM Test`,
      description: 'Test for rounding and precision on large numbers',
      invite: '',
      data: '{}',
      meta: '{}',
    }

    await blockchain.api.transact({
      actions: [{
        account: CapitalContract.contractName.production,
        name: CapitalContract.Actions.CreateProject.actionName,
        authorization: [{ actor: 'voskhod', permission: 'active' }],
        data: projectData,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    console.log('\n--- НАЧАЛЬНЫЕ БАЛАНСЫ (БЛАГОРОСТ) ---')
    for (const p of [tester1, tester2, this_investor, tester5]) {
      const wallet = await getUserProgramWalletAmount(blockchain, 'voskhod', p, capitalProgramId)
      console.log(`${p}: ${wallet}`)
    }

    // 2. Регистрация участников: signAppendix + regshare — отдельные действия.
    // signAppendix добавляет project_hash в appendixes контрибьютора; сегмент
    // в проекте не создаётся. regshare (capital::regshare) создаёт/обновляет
    // сегмент с user_shares = баланс Благороста. Делаем regshare только для
    // тех, у кого баланс > 0 — иначе проект не увидит их как contributor.
    const participants = [tester1, tester2, this_investor, tester5]
    for (const p of participants) {
      await signAppendix(blockchain, 'voskhod', p, highPrecisionHash, generateRandomSHA256())
      const balance = await getUserProgramWalletAmount(blockchain, 'voskhod', p, capitalProgramId)
      const amount = parseFloat(balance.split(' ')[0])
      if (amount > 0) {
        await processRegShare(blockchain, 'voskhod', highPrecisionHash, p, balance)
      }
      const segment = await getSegment(blockchain, 'voskhod', highPrecisionHash, p)
      console.log(`Сегмент ${p} после signAppendix+regshare (balance=${balance}):`, segment)
    }

    const projectAfterReg = await getProject(blockchain, 'voskhod', highPrecisionHash)
    console.log('\n--- СОСТОЯНИЕ ПРОЕКТА ПОСЛЕ РЕГИСТРАЦИИ ---')
    console.log('total_capital_contributors_shares:', projectAfterReg.crps.total_capital_contributors_shares)
    console.log('counts.total_contributors:', projectAfterReg.counts.total_contributors)

    console.log('\n=== ДЕТАЛЬНЫЙ АУДИТ УЧАСТНИКОВ (ПОСЛЕ РЕГИСТРАЦИИ) ===')
    const participantsAudit = []
    const auditMap = { tester1, tester2, this_investor, tester5 }

    for (const [key, username] of Object.entries(auditMap)) {
      const wallet = await getUserProgramWalletAmount(blockchain, 'voskhod', username, capitalProgramId)
      const seg = await getSegment(blockchain, 'voskhod', highPrecisionHash, username)
      participantsAudit.push({
        var: key,
        user: username,
        Благорост: wallet,
        ...seg,
      })
    }
    console.table(participantsAudit)

    console.log('\n=== АУДИТ ПУЛОВ ПРОЕКТА ===')
    const pools = projectAfterReg.fact
    console.log(`Authors Base Pool:   ${pools.authors_base_pool}`)
    console.log(`Creators Base Pool:  ${pools.creators_base_pool}`)
    console.log(`Authors Bonus Pool:  ${pools.authors_bonus_pool}`)
    console.log(`Creators Bonus Pool: ${pools.creators_bonus_pool}`)
    console.log(`Investors Base Pool: ${pools.invest_pool}`)
    console.log(`Coordinators Base:   ${pools.coordinators_base_pool}`)
    console.log(`Contributors Bonus:  ${pools.contributors_bonus_pool}`)
    console.log(`Total Project:       ${pools.total}`)

    // 3. Устанавливаем мастера
    await blockchain.api.transact({
      actions: [{
        account: CapitalContract.contractName.production,
        name: CapitalContract.Actions.SetMaster.actionName,
        authorization: [{ actor: 'voskhod', permission: 'active' }],
        data: { coopname: 'voskhod', project_hash: highPrecisionHash, master: tester1 },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    // 4. Планируем проект на 10 000 часов
    await blockchain.api.transact({
      actions: [{
        account: CapitalContract.contractName.production,
        name: CapitalContract.Actions.SetPlan.actionName,
        authorization: [{ actor: 'voskhod', permission: 'active' }],
        data: {
          coopname: 'voskhod',
          master: tester1,
          project_hash: highPrecisionHash,
          plan_creators_hours: 10000,
          plan_expenses: '0.0000 RUB',
          plan_hour_cost: '1000.0000 RUB',
        },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    // 5. Стартуем проект
    await blockchain.api.transact({
      actions: [{
        account: CapitalContract.contractName.production,
        name: CapitalContract.Actions.StartProject.actionName,
        authorization: [{ actor: 'voskhod', permission: 'active' }],
        data: { coopname: 'voskhod', project_hash: highPrecisionHash },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    // Аудит ДО инвестирования - после старта проекта
    await auditParticipants('0.4. ПРОЕКТ СТАРТОВАН', highPrecisionHash)

    // Открываем проект для инвестиций
    await blockchain.api.transact({
      actions: [{
        account: CapitalContract.contractName.production,
        name: CapitalContract.Actions.OpenProject.actionName,
        authorization: [{ actor: 'voskhod', permission: 'active' }],
        data: { coopname: 'voskhod', project_hash: highPrecisionHash },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    await depositToWallet(blockchain, 'voskhod', this_investor, largeInvestAmount)
    fakeDocument.signatures[0].signer = this_investor
    await investInProject(blockchain, 'voskhod', this_investor, highPrecisionHash, `${largeInvestAmount.toFixed(4)} RUB`, fakeDocument)
    console.log(`✅ Инвестировано: ${largeInvestAmount} RUB`)

    for (const p of participants) {
      await refreshSegment(blockchain, 'voskhod', highPrecisionHash, p)
      await sleep(200)
    }

    await auditParticipants('1. ИНВЕСТИЦИЯ', highPrecisionHash)

    // 7. Два взноса по 5000 часов
    console.log('--- Взнос результата: 5000 часов от tester1 ---')
    await commitToResult(blockchain, 'voskhod', highPrecisionHash, tester1, 5000)
    await sleep(500)
    console.log('--- Взнос результата: 5000 часов от tester2 ---')
    await commitToResult(blockchain, 'voskhod', highPrecisionHash, tester2, 5000)

    for (const p of participants) {
      await refreshSegment(blockchain, 'voskhod', highPrecisionHash, p)
      await sleep(200)
    }

    await auditParticipants('2. ВЗНОСЫ ВРЕМЕНЕМ', highPrecisionHash)

    // 8. Переход к голосованию
    await processStartVoting(blockchain, { coopname: 'voskhod', project_hash: highPrecisionHash })

    // Голосуем
    const voters = [tester1, tester2]
    for (const voter of voters) {
      const project = await getProject(blockchain, 'voskhod', highPrecisionHash)
      const votingAmount = project.voting.amounts.active_voting_amount
      const recipients = voters.filter(v => v !== voter)
      const voteDistribution = createVoteDistribution(recipients, voter, votingAmount)
      await submitVote(blockchain, 'voskhod', voter, highPrecisionHash, voteDistribution)
    }

    // Завершаем голосование
    await processCompleteVoting(blockchain, { coopname: 'voskhod', project_hash: highPrecisionHash })

    await auditParticipants('3. ГОЛОСОВАНИЕ (ДО ПОДСЧЕТА)', highPrecisionHash)

    // Рассчитываем голоса и обновляем сегменты
    for (const p of participants) {
      if (voters.includes(p)) {
        await processCalculateVotes(blockchain, { coopname: 'voskhod', username: p, project_hash: highPrecisionHash })
      }
      await refreshSegment(blockchain, 'voskhod', highPrecisionHash, p)
      await sleep(200)
    }

    await auditParticipants('4. ФИНАЛ (ОБНОВЛ. СЕГМЕНТЫ)', highPrecisionHash)

    // Разделяем данные на две таблицы
    const segmentsTable = auditHistory.map(entry => ({
      ЭТАП: entry['ЭТАП'],
      var: entry.var,
      user: entry.user,
      Благорост: entry['Благорост'],
      share_percent: entry.share_percent,
      intellectual_cost: entry.intellectual_cost,
      // investor_base: entry.investor_base,
      coordinator_base: entry.coordinator_base,
      contributor_bonus: entry.contributor_bonus,
    }))

    const poolsTable = auditHistory.map(entry => ({
      ЭТАП: entry['ЭТАП'],
      var: entry.var,
      P_Inv: entry.P_Inv,
      P_ContrB: entry.P_ContrB,
      P_Total: entry.P_Total,
    }))

    console.log('\n🚀 СВОДНАЯ ТАБЛИЦА СЕГМЕНТОВ 🚀')
    console.table(segmentsTable)

    console.log('\n🚀 СВОДНАЯ ТАБЛИЦА ПУЛОВ 🚀')
    console.table(poolsTable)

    // 9. ФИНАЛЬНЫЙ АУДИТ
    console.log('\n=== ФИНАЛЬНЫЙ АУДИТ ТОЧНОСТИ (RESULT) ===\n')
    const finalProject = await getProject(blockchain, 'voskhod', highPrecisionHash)
    let totalSharePercent = 0
    const segmentsData = []

    for (const p of participants) {
      const seg = await getSegment(blockchain, 'voskhod', highPrecisionHash, p)
      const share = Number(seg.share_percent)
      totalSharePercent += share
      segmentsData.push({
        user: p,
        share,
        intellectual_cost: seg.intellectual_cost,
        bonus: seg.contributor_bonus,
      })
    }

    console.table(segmentsData)
    console.log(`\nИТОГОВАЯ СУММА share_percent: ${totalSharePercent.toFixed(10)}%`)
    console.log(`ОШИБКА ТОЧНОСТИ: ${(100 - totalSharePercent).toFixed(10)}%`)
    console.log(`ОБЩАЯ СУММА В ПРОЕКТЕ: ${finalProject.fact.total}`)
    console.log(`ОБЩАЯ СУММА В ПРОЕКТЕ с ДЕНЬГАМИ: ${finalProject.fact.total_with_investments}`)
    console.log(`ДОЛЯ РАННИХ УЧАСТНИКОВ: ${finalProject.fact.contributors_bonus_pool}`)

    expect(totalSharePercent).toBeCloseTo(100, 2)
  })
})
