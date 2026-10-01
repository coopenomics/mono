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
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { GqlResponse, Who } from '../core'
import {
  CHAIN_NODE,
  FAULTS_ENABLED,
  ROLES,
  amount,
  awaitChainProducing,
  awaitNodeSynced,
  caseName,
  ensureShareFunds,
  gql,
  gqlRaw,
  startService,
  stopService,
  tokenOf,
  waitFor,
} from '../core'
import { getOrder, pickOffer, sagaOf } from '../marketplace/flow'
import { FINALIZE, bundlePayloads, createBundle, finalizeInput, money, prepareReceivedOrder, price2, signStatement } from '../marketplace/issuance.helpers'
import type { PreparedOrder } from '../marketplace/issuance.helpers'

const STATE = 'query{ getNodeSyncState{ status outage current_block_num head_block_num lag_blocks } }'

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
    }
    finally {
      await startService(CHAIN_NODE)
    }
    await awaitChainProducing()
    await awaitNodeSynced()

    retried = await gqlRaw(memberToken, FINALIZE, input)
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

  it(caseName('mkt.iss.break.01', 'цепь недоступна в момент подписи заявления — отказ, выдача не двигается, причина сохранена'), () => {
    expect(refused.errors.length, 'подпись без цепи отклонена').toBeGreaterThan(0)
    expect(refused.status, 'отказ — ответ узла, а не его падение').toBeLessThan(500)
    expect(refusedAfterMs, 'отказ не повис на недоступной цепи').toBeLessThan(60_000)
    expect(sagaWhileDown.stage, 'ход выдачи на прежнем этапе').toBe('FACT_FIXED')
    expect(sagaWhileDown.decision_id ?? null, 'повестки совета нет').toBeNull()
    expect(sagaWhileDown.last_error, 'причина отказа сохранена').toBeTruthy()
    expect(orderWhileDown.status, 'имущество не передано').toBe('READY_TO_RECEIVE')
  })

  it(caseName('mkt.iss.break.01', 'цепь вернулась — та же подпись проходит повторно'), async () => {
    expect(retried.errors, JSON.stringify(retried.errors)).toEqual([])
    const saga = retried.data.marketplaceFinalizeStockIssuance.sagas.find((s: any) => s.order_id === order.orderId)
    expect(['DECISION_PENDING', 'DECISION_AUTHORIZED']).toContain(saga.stage)
    expect(saga.last_error ?? null).toBeNull()
    expect((await getOrder(memberToken, order.orderId)).status).not.toBe('CANCELLED')
  })
})
