/**
 * Фаза 07 — назначает мастера компонента «MVP v1» и устанавливает план через SDK.
 *
 * Председатель `ant` (он же создатель компонента) становится мастером, после чего
 * ставится план: 160 ч исполнителей × 1500 ₽/ч + 50 000 ₽ дополнительных расходов.
 *
 * После этой фазы:
 *   - is_planed = true → переключатель «Принимает инвестиции» на компоненте
 *     можно включить;
 *   - вкладки «План» компонента и проекта показывают агрегированные значения.
 *
 * Зависит от фазы 06 (проект и компонент должны существовать). Идемпотентна
 * через query GetProjectWithRelations: если master уже = ant и is_planed = true,
 * фаза становится no-op.
 */
import { Client, Mutations, Queries } from '@coopenomics/sdk'
import { CapitalContract, SovietContract } from 'cooptypes'
import { createHash } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:07]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

// План — реалистичные значения для документации.
// 160 ч × 5000 ₽ = 800 000 ₽ за время исполнителей; + 50 000 ₽ доп. расходов.
const PLAN_HOURS = 160
const PLAN_HOUR_COST = '5000.0000 RUB'
const PLAN_EXPENSES = '50000.0000 RUB'

interface IProjectState {
  master?: string
  is_planed?: boolean
}

// fakeDocument-обёртка для approved_document — соответствует
// тестовому шаблону `tests/shared/fakeDocument.ts`. Председатель `ant`
// в signatures[0].signer.
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
  contributor_hash?: string
  contract?: { hash?: string }
}

// УХД-договор председателя должен быть в статусе `active`, иначе capital::setmaster
// падает с «Основной договор УХД не активен». В контракт-тестах этот переход
// делается через soviet::confirmapprv (см. tests/capital/processApprove.ts).
// CompleteCapitalRegistration через GraphQL оставляет status=pending, поэтому
// approve приходится проводить отдельно.
async function approveContributorContract(
  blockchain: Blockchain,
  username: string,
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
  if (!row) throw new Error(`Contributor ${username} не найден в таблице capital::contributors`)
  if (row.status === 'active') {
    log(`УХД-договор ${username} уже active — пропуск approve`)
    return
  }
  // approval_hash в soviet::approvals = contributor_hash, не contract.hash
  // (см. capital::regcontrib → Soviet::make_pending_approve(..., contributor_hash, ...))
  const approvalHash = row.contributor_hash
  if (!approvalHash) throw new Error(`У contributor ${username} нет contributor_hash`)

  log(`soviet::confirmapprv ${username} (approval_hash=${approvalHash.slice(0, 10)}...)`)
  await blockchain.api.transact({
    actions: [{
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Approves.ConfirmApprove.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username: CHAIRMAN, // approver — председатель
        approval_hash: approvalHash,
        approved_document: fakeDocumentSignedBy(CHAIRMAN),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

// Подпись приложения к проекту/компоненту: capital::getclearance + soviet::confirmapprv
// (см. tests/capital/signAppendix.ts). После этого contributor.appendixes содержит
// projectHash, и пайщик считается «участником проекта», что требуется для setMaster
// и других ролевых действий.
//
// appendix_hash — детерминированный хеш для идемпотентности (sha256 от username:projectHash:tag).
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
  const row = rows[0] as IContributorRow & { appendixes?: string[] }
  if (!row) throw new Error(`Contributor ${username} не найден`)
  if (row.appendixes?.includes(projectHash)) {
    log(`${username} уже подписал приложение к проекту/компоненту (${projectHash.slice(0, 10)}...) — пропуск`)
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

export async function phase07(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  // Активируем УХД-договоры всех трёх участников — нужно для:
  //   - председателя (setMaster, setPlan)
  //   - ivanpetrov / ekaterina (для будущих фаз: инвестирование, коммиты, голосование).
  // Идемпотентно: если status уже active, approve пропускается.
  for (const username of [CHAIRMAN, 'ivanpetrov', 'ekaterina']) {
    await approveContributorContract(blockchain, username)
  }

  // Председатель должен подписать приложение к компоненту, чтобы стать «участником»,
  // иначе setMaster падает с «Мастер должен быть участником проекта».
  await signAppendixIfNeeded(blockchain, CHAIRMAN, COMPONENT_HASH, 'mvp-v1')

  const info = await blockchain.getInfo()
  const chainId = info.chain_id
  const chainUrl = `${config.network.protocol}://${config.network.host}${config.network.port}`
  const apiUrl = process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql'

  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан в env')

  const client = Client.create({
    api_url: apiUrl,
    chain_url: chainUrl,
    chain_id: chainId,
    wif,
    username: CHAIRMAN,
  })
  log(`логин ${CHAIRMAN_EMAIL}...`)
  await client.login(CHAIRMAN_EMAIL, wif)

  // Поллинг до 60с пока parser не индексирует createproject от фазы 06.
  // После reboot:extra controller-БД пуста, индексация занимает ~3-10с.
  // Без этого SetPlan падает с «Проект не найден» — мутация делает
  // валидацию через repository ещё до отправки on-chain.
  let current: IProjectState = {}
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const resp = await client.Query(Queries.Capital.GetProjectWithRelations.query, {
        variables: {
          // GetProjectWithRelationsInput: только projectHash (camelCase),
          // в отличие от SetMasterInput/SetPlanInput, которые принимают
          // coopname+project_hash. Несимметрия в backend GraphQL.
          data: { projectHash: COMPONENT_HASH },
        } as Queries.Capital.GetProjectWithRelations.IInput,
      }) as Record<string, IProjectState | null>
      const got = resp[Queries.Capital.GetProjectWithRelations.name]
      if (got && (got.master !== undefined || got.is_planed !== undefined)) {
        current = got
        log(`parser индексировал проект (attempt ${attempt + 1})`)
        break
      }
      // Ответ есть, но без полей — проект ещё не догнан.
      if (attempt < 29) {
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      log('parser не индексировал проект за 60с — продолжаем без current state')
    } catch (e) {
      // GraphQL «Проект не найден» — ждём parser. Любая иная ошибка — break.
      const raw = JSON.stringify(e).toLowerCase()
      if (raw.includes('не найден') && attempt < 29) {
        if (attempt % 5 === 0) log(`parser ещё не догнал createproject — ждём 2с (${attempt + 1}/30)`)
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      log(`Query GetProjectWithRelations упал не на «не найден»: ${raw.slice(0, 200)}`)
      break
    }
  }

  if (current.master !== CHAIRMAN) {
    log(`SetMaster → master=${CHAIRMAN} для компонента MVP v1`)
    await client.Mutation(Mutations.Capital.SetMaster.mutation, {
      variables: {
        data: {
          coopname: COOPNAME,
          master: CHAIRMAN,
          project_hash: COMPONENT_HASH,
        },
      } as Mutations.Capital.SetMaster.IInput,
    })
  } else {
    log(`master уже ${CHAIRMAN} — пропуск SetMaster`)
  }

  if (!current.is_planed) {
    log(`SetPlan → ${PLAN_HOURS} ч × ${PLAN_HOUR_COST} + ${PLAN_EXPENSES} расходов`)
    const planResp = await client.Mutation(Mutations.Capital.SetPlan.mutation, {
      variables: {
        data: {
          coopname: COOPNAME,
          master: CHAIRMAN,
          project_hash: COMPONENT_HASH,
          plan_creators_hours: PLAN_HOURS,
          plan_hour_cost: PLAN_HOUR_COST,
          plan_expenses: PLAN_EXPENSES,
        },
      } as Mutations.Capital.SetPlan.IInput,
    }) as Record<string, IProjectState | null>
    const updated = planResp[Mutations.Capital.SetPlan.name]
    log(`SetPlan response: master=${updated?.master}, is_planed=${updated?.is_planed}`)
  } else {
    log('is_planed уже true — пропуск SetPlan')
  }

  log('фаза 07 завершена')
}
