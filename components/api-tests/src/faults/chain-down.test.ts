/**
 * Цепь недоступна (test-registry/system.node-sync-indication.yaml,
 * marketplace.issuance.yaml).
 *
 * Набор штатно останавливает узел цепи стенда и смотрит снаружи, что узел
 * кооператива сообщает о себе и как отвечает мутация, которой нужна
 * транзакция. Затем цепь запускается снова, и та же мутация повторяется.
 *
 * Всё, чему нужна цепь (вход, взносы, подготовка заказа, подписи), делается
 * до остановки: во время неё набор ходит только в API узла.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { GqlResponse, Who } from '../core'
import {
  CHAIN_NODE,
  CHAIRMAN,
  COOP,
  FAULTS_ENABLED,
  ROLES,
  amount,
  awaitChainProducing,
  awaitNodeSynced,
  caseName,
  ensureShareFunds,
  freshMember,
  gql,
  gqlRaw,
  login,
  signDocument,
  startService,
  stopService,
  tokenOf,
  waitFor,
} from '../core'
import { getOrder, pickOffer, sagaOf } from '../marketplace/flow'
import { FINALIZE, bundlePayloads, createBundle, finalizeInput, money, prepareReceivedOrder, price2, signStatement } from '../marketplace/issuance.helpers'
import type { PreparedOrder } from '../marketplace/issuance.helpers'

const STATE = 'query{ getNodeSyncState{ status outage current_block_num head_block_num lag_blocks } }'
const CPP_STATUS = 'query{ marketplaceCppStatus{ status document_registry_id } }'
const ONBOARDING_STATE = 'query{ marketplaceOnboardingState{ requires_gate source completed_at } }'
const SIGN_OFFER = `mutation($i:MarketplaceSignOnboardingOfferInput!){
  marketplaceSignOnboardingOffer(input:$i){ requires_gate source completed_at }
}`
const EXTENSIONS = 'query($d:GetExtensionsInput){ getExtensions(data:$d){ name enabled config } }'
const UPDATE_EXTENSION = 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }'

describe.skipIf(!FAULTS_ENABLED)('цепь стенда остановлена и запущена снова', () => {
  let member: Who
  let memberToken = ''
  let order: PreparedOrder
  let input: ReturnType<typeof finalizeInput>
  let stateWhileDown: any
  let refused: GqlResponse<any>
  let refusedAfterMs = 0
  let sagaWhileDown: any
  let orderWhileDown: any
  let retried: GqlResponse<any>
  let newcomerToken = ''
  let signedOffer: any
  let offerRefused: GqlResponse<any>
  let gateWhileDown: GqlResponse<any>
  let offerRetried: GqlResponse<any>
  let restartWhileDown: GqlResponse<any>
  let cppWhileDown: GqlResponse<any>

  beforeAll(async () => {
    await awaitNodeSynced()
    member = ROLES.member()
    const supplier = ROLES.supplier()
    const operator = ROLES.branchChairman()
    memberToken = await tokenOf(member)
    const operatorToken = await tokenOf(operator)

    const offer = await pickOffer(supplier.account, undefined, 'Мёд цветочный')
    const price = amount(offer.price_per_unit)
    const arrival = price2(price * 0.9)
    await ensureShareFunds(member.account, price * 4, memberToken)
    order = await prepareReceivedOrder({ member, supplier, operator, offerId: offer.id, quantity: 1, receivedQuantity: 1, arrivalPrice: arrival })
    const proposalId = await createBundle(operatorToken, member.account, [
      { order_id: order.orderId, actual_quantity: 1, actual_unit_price: money(arrival) },
    ])
    const payloads = await bundlePayloads(memberToken, proposalId)
    input = finalizeInput(proposalId, [
      { order_hash: order.orderHash, signed_statement: await signStatement(member, payloads.statements.get(order.orderHash)) },
    ])

    // Новый пайщик с подписанной офертой Стола заказов — подать её он попробует без цепи.
    const newcomer = freshMember({ prefix: 'cdn' })
    newcomerToken = await login(newcomer)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const offerDoc = (await gql<any>(newcomerToken, `mutation($i:GenerateAnyDocumentInput!){
      generateDocument(input:$i){ full_title html hash meta binary }
    }`, {
      i: {
        data: {
          registry_id: 1102,
          coopname: COOP,
          username: newcomer.account,
          marketplace_agreement_number: crypto.randomBytes(8).toString('hex').toUpperCase(),
          marketplace_agreement_created_at: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`,
        },
      },
    })).generateDocument
    signedOffer = await signDocument(newcomer.wif, offerDoc, newcomer.account, 1)
    const chairmanToken = await tokenOf(CHAIRMAN)
    const market = ((await gql<any>(chairmanToken, EXTENSIONS, { d: { name: 'market' } })).getExtensions as any[]).find(e => e.name === 'market')

    await stopService(CHAIN_NODE)
    try {
      stateWhileDown = await waitFor(async () => {
        const s = (await gql<any>(null, STATE)).getNodeSyncState
        return s?.status === 'DISCONNECTED' ? s : null
      }, { timeoutMs: 60_000, intervalMs: 500, label: 'состояния «связи нет» при остановленной цепи' })

      const started = Date.now()
      refused = await gqlRaw(memberToken, FINALIZE, input)
      refusedAfterMs = Date.now() - started
      sagaWhileDown = await sagaOf(memberToken, order.orderId)
      orderWhileDown = await getOrder(memberToken, order.orderId)

      offerRefused = await gqlRaw(newcomerToken, SIGN_OFFER, { i: { document: signedOffer } })
      gateWhileDown = await gqlRaw(newcomerToken, ONBOARDING_STATE)

      // Расширение перезапускается без цепи: старт не должен от неё зависеть.
      restartWhileDown = await gqlRaw(chairmanToken, UPDATE_EXTENSION, { d: { name: 'market', enabled: market.enabled, config: market.config ?? {} } })
      cppWhileDown = await waitFor(async () => {
        const r = await gqlRaw<any>(memberToken, CPP_STATUS)
        return r.errors.length === 0 ? r : null
      }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'расширение Стола заказов поднялось без цепи' })
    }
    finally {
      await startService(CHAIN_NODE)
    }
    await awaitChainProducing()
    await awaitNodeSynced()
    // Следующий старт расширения повторяет то, что не удалось без цепи.
    await gql(chairmanToken, UPDATE_EXTENSION, { d: { name: 'market', enabled: market.enabled, config: market.config ?? {} } })
    await waitFor(async () => ((await gqlRaw<any>(memberToken, CPP_STATUS)).errors.length === 0 ? true : null),
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'расширение Стола заказов поднялось после возврата цепи' })

    retried = await gqlRaw(memberToken, FINALIZE, input)
    offerRetried = await gqlRaw(newcomerToken, SIGN_OFFER, { i: { document: signedOffer } })
  }, 900_000)

  afterAll(async () => {
    await startService(CHAIN_NODE).catch(() => {})
    await awaitChainProducing()
    await awaitNodeSynced()
  })

  it(caseName('sync.ind.break.01', 'цепь не отвечает — «связи нет», причина — цепь, а не мнимый догон'), () => {
    expect(stateWhileDown.status).toBe('DISCONNECTED')
    expect(stateWhileDown.outage).toBe('CHAIN')
    // Голова цепи неизвестна — отставание не выдумывается.
    expect(stateWhileDown.head_block_num ?? null).toBeNull()
    expect(stateWhileDown.lag_blocks ?? null).toBeNull()
  })

  it(caseName('mkt.iss.break.01', 'цепь недоступна в момент подписи заявления — отказ с кодом, выдача не двигается, причина сохранена, имущество не передано'), () => {
    // До 02.10.2026 ответ был внутренней ошибкой «fetch failed» без кода, а причина в
    // ходе выдачи не сохранялась (C28-85, находка 52).
    expect(refused.errors.length, 'подпись без цепи отклонена').toBeGreaterThan(0)
    expect(refused.errors[0].code, refused.errors[0].message).toBe('BLOCKCHAIN_UNAVAILABLE')
    expect(refused.errors[0].message).not.toMatch(/fetch failed/)
    expect(refusedAfterMs, 'отказ не повис на недоступной цепи').toBeLessThan(60_000)
    expect(sagaWhileDown.stage, 'ход выдачи на прежнем этапе').toBe('FACT_FIXED')
    expect(sagaWhileDown.decision_id ?? null, 'повестки совета нет').toBeNull()
    expect(sagaWhileDown.last_error, 'причина отказа сохранена в ходе выдачи').toBeTruthy()
    expect(orderWhileDown.status, 'имущество не передано').toBe('READY_TO_RECEIVE')
  })

  it(caseName('mkt.iss.break.01', 'цепь вернулась — та же подпись проходит повторно'), async () => {
    expect(retried.errors, JSON.stringify(retried.errors)).toEqual([])
    const saga = retried.data.marketplaceFinalizeStockIssuance.sagas.find((s: any) => s.order_id === order.orderId)
    expect(['DECISION_PENDING', 'DECISION_AUTHORIZED']).toContain(saga.stage)
    expect(saga.last_error ?? null).toBeNull()
    expect((await getOrder(memberToken, order.orderId)).status).not.toBe('CANCELLED')
  })

  it(caseName('mkt.onb.break.01', 'цепь недоступна в момент подписания оферты — пайщику отказ, оферта не считается подписанной, повтор после возврата цепи проходит'), () => {
    expect(offerRefused.errors.length, 'подпись оферты без цепи отклонена').toBeGreaterThan(0)
    expect(offerRefused.data?.marketplaceSignOnboardingOffer ?? null).toBeNull()
    // Состояние без цепи читается либо не читается, но подписанным не объявлено.
    expect(gateWhileDown.data?.marketplaceOnboardingState?.source ?? 'GATE_REQUIRED').toBe('GATE_REQUIRED')

    expect(offerRetried.errors, JSON.stringify(offerRetried.errors)).toEqual([])
    expect(offerRetried.data.marketplaceSignOnboardingOffer.source).toBe('AGREEMENT_SIGNED')
  })

  it(caseName('mkt.onb.break.04', 'цепь недоступна в момент старта расширения — расширение всё равно поднимается и отвечает'), () => {
    expect(restartWhileDown.errors, JSON.stringify(restartWhileDown.errors)).toEqual([])
    expect(cppWhileDown.data.marketplaceCppStatus.status, 'принятая прежде ЦПП видна и без цепи').toBe('active')
  })
})
