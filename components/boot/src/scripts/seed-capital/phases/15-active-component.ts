/**
 * Фаза 15 — компонент в статусе Active без коммитов.
 *
 * Берёт компонент «Минимальный продукт» (id=15) под проектом «Приложение
 * Стол Заказов» (id=3) — он создан фазой 03 как pending. Превращает в
 * стартовое состояние «работа открыта, коммитов ещё нет»:
 *   - clearance ant/ivanpetrov/ekaterina к проекту-3 и к компоненту-15;
 *   - setmaster=ant на компонент-15;
 *   - setplan на компонент-15 (160 ч × 1500 RUB);
 *   - startproject на компонент-15 → status=Active.
 *
 * Не создаёт задачи, коммиты и не открывает голосование. UI должен показать
 * проект «Стол заказов» с компонентом «Минимальный продукт» в статусе Active
 * с назначенным мастером, готовый принимать коммиты.
 */
import { Client, Mutations } from '@coopenomics/sdk'
import { CapitalContract, SovietContract } from 'cooptypes'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:15]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'

// id=3 «Приложение Стол Заказов» (parent для component-15)
const PROJECT_HASH = '79fc8a7e99f17449d13a399421f5a9edbad31187eae36462307a9744aa45d917'
// id=15 «Минимальный продукт»
const COMPONENT_HASH = '759ac130a21c9586e3b9028ecbbc42805cc0593fe51042c4ad2113cbb1a938e6'

const PARTICIPANTS = ['ant', 'ivanpetrov', 'ekaterina'] as const

const FAKE_HASH = '157192b276da23cc84ab078fc8755c051c5f0430bf4802e55718221e6b76c777'
function fakeDoc(signer: string) {
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

import { createHash } from 'node:crypto'
function makeAppendixHash(username: string, projectHash: string, tag: string): string {
  return createHash('sha256').update(`appendix:15:${username}:${projectHash}:${tag}`).digest('hex')
}

interface IContributorRow {
  username?: string
  appendixes?: string[]
}

async function signClearance(blockchain: Blockchain, username: string, projectHash: string, tag: string) {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME, 'contributors', 1, username, username, 2, 'i64',
  ) as IContributorRow[]
  if (rows[0]?.appendixes?.map(h => h.toLowerCase()).includes(projectHash.toLowerCase())) {
    log(`${username} → ${projectHash.slice(0, 10)}... уже есть допуск, пропуск`)
    return
  }
  const appendixHash = makeAppendixHash(username, projectHash, tag)
  log(`getclearance ${username} → ${projectHash.slice(0, 10)}...`)
  await blockchain.api.transact({
    actions: [{
      account: 'capital',
      name: 'getclearance',
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: { coopname: COOPNAME, username, project_hash: projectHash, appendix_hash: appendixHash, document: fakeDoc(username) },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
  // Sleep ≥ block_time чтобы getclearance и confirmapprv ушли в разные блоки —
  // иначе SHIP схлопнет дельту appendixes (insert+erase в одном блоке).
  await new Promise(r => setTimeout(r, 700))
  log(`confirmapprv ${username} (${appendixHash.slice(0, 10)}...)`)
  await blockchain.api.transact({
    actions: [{
      account: 'soviet',
      name: SovietContract.Actions.Approves.ConfirmApprove.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: { coopname: COOPNAME, username: CHAIRMAN, approval_hash: appendixHash, approved_document: fakeDoc(CHAIRMAN) },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

export async function phase15(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  // 1. Clearance всем трём — к проекту и к компоненту.
  for (const u of PARTICIPANTS) {
    for (const [hash, tag] of [[PROJECT_HASH, 'project-3'], [COMPONENT_HASH, 'component-15']] as const) {
      await signClearance(blockchain, u, hash, tag)
    }
  }

  // 2. setmaster + setplan + startproject через GraphQL controller (мастер ant).
  const info = await blockchain.getInfo()
  const apiUrl = process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql'
  const chainUrl = `${config.network.protocol}://${config.network.host}${config.network.port}`
  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан')

  const client = Client.create({ api_url: apiUrl, chain_url: chainUrl, chain_id: info.chain_id, wif, username: CHAIRMAN })
  log(`логин ${CHAIRMAN_EMAIL}...`)
  await client.login(CHAIRMAN_EMAIL, wif)

  log(`setmaster ant → component «Минимальный продукт»`)
  await client.Mutation(Mutations.Capital.SetMaster.mutation, {
    variables: { data: { coopname: COOPNAME, project_hash: COMPONENT_HASH, master: CHAIRMAN } } as Mutations.Capital.SetMaster.IInput,
  }).catch((e: any) => log(`SetMaster: ${e.message?.slice(0, 100) ?? e}`))

  log(`setplan: 160 ч × 1500 RUB + 0 расходов`)
  await client.Mutation(Mutations.Capital.SetPlan.mutation, {
    variables: {
      data: {
        coopname: COOPNAME,
        project_hash: COMPONENT_HASH,
        plan_hours: 160,
        hour_cost: '1500.0000 RUB',
        plan_other_expenses: '0.0000 RUB',
      },
    } as Mutations.Capital.SetPlan.IInput,
  }).catch((e: any) => log(`SetPlan: ${e.message?.slice(0, 100) ?? e}`))

  log(`startproject → Active`)
  await blockchain.api.transact({
    actions: [{
      account: 'capital',
      name: 'startproject',
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: { coopname: COOPNAME, project_hash: COMPONENT_HASH },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 }).catch((e: any) => log(`startproject: ${e.message?.slice(0, 100) ?? e}`))

  log('фаза 15 завершена — компонент Active, без коммитов')
}
