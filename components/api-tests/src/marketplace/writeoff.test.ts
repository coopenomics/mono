/**
 * Списание скоропорта (реестр marketplace.writeoff, level backend) — снаружи,
 * через API стенда: причина обязательна, проводит списание только
 * председатель своего участка и только после решения совета.
 *
 * Проект списания на кооператив один открытый: если черновик уже есть (крон
 * или соседний сценарий), проверки идут на нём и он не трогается; свой
 * черновик тест снимает за собой.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, amount, caseName, ensureShareFunds, gql, gqlError, signDocument, tokenOf } from '../core'
import type { Who } from '../core'
import { KRG, issueOrder, pickOffer } from './flow'
import { inventoryOfOrder, prepareReceivedOrder } from './issuance.helpers'
import { CANDIDATES, warrantyReturn } from './writeoff.helpers'

const PROPOSAL_FIELDS = 'id status total_amount items{ braname asset_title quantity amount reason executed }'
const OPEN_DRAFT = `query{ marketplaceOpenWriteoffDraft{ ${PROPOSAL_FIELDS} } }`
const CREATE_DRAFT = `mutation($d:MarketplaceCreateWriteoffDraftInput!){ marketplaceCreateWriteoffDraft(data:$d){ ${PROPOSAL_FIELDS} } }`
const UPDATE_DRAFT = `mutation($d:MarketplaceUpdateWriteoffDraftInput!){ marketplaceUpdateWriteoffDraft(data:$d){ ${PROPOSAL_FIELDS} } }`
const PROPOSAL = `query($id:String!){ marketplaceWriteoffProposal(id:$id){ ${PROPOSAL_FIELDS} } }`
const MEMO_PAYLOAD = `query($d:MarketplaceWriteoffServiceMemoSignablePayloadInput!){
  marketplaceWriteoffServiceMemoSignablePayload(data:$d){ full_title html hash meta binary }
}`
const CONFIRM = `mutation($d:MarketplaceConfirmWriteoffInput!){ marketplaceConfirmWriteoff(data:$d){ id status } }`
const STATEMENT_PAYLOAD = `query($d:MarketplaceWriteoffStatementSignablePayloadInput!){
  marketplaceWriteoffStatementSignablePayload(data:$d){ full_title html hash meta binary }
}`

function item(reason: string) {
  return {
    braname: KRG,
    asset_title: 'Внешний тест: проверка списания',
    quantity: '1',
    amount: '1.0000',
    reason,
    inventory_ids: [],
  }
}

let chairmanToken = ''
let krgChairman: Who
let odnChairman: Who
let krgToken = ''
let odnToken = ''
/** Черновик, на котором идут проверки; свой — снимается в конце. */
let draft: any = null
let ownDraft = false

beforeAll(async () => {
  chairmanToken = await tokenOf(CHAIRMAN)
  krgChairman = ROLES.branchChairman()
  odnChairman = ROLES.foreignBranchChairman()
  krgToken = await tokenOf(krgChairman)
  odnToken = await tokenOf(odnChairman)
})

afterAll(async () => {
  if (ownDraft && draft)
    await gql(chairmanToken, 'mutation($id:String!){ marketplaceCancelWriteoffDraft(id:$id) }', { id: draft.id })
})

describe('списание скоропорта: состав проекта и кто его проводит', () => {
  it(caseName('mkt.wof.side.01', 'проект списания без причины — отказ, черновик не меняется'), async () => {
    const open = (await gql<any>(chairmanToken, OPEN_DRAFT)).marketplaceOpenWriteoffDraft
    for (const reason of ['', '   ']) {
      const err = open
        ? await gqlError(chairmanToken, UPDATE_DRAFT, { d: { id: open.id, items: [item(reason)] } })
        : await gqlError(chairmanToken, CREATE_DRAFT, { d: { items: [item(reason)] } })
      expect(err?.code, `причина обязательна («${reason}»)`).toBe('MARKETPLACE_WRITEOFF_ITEM_REASON_REQUIRED')
    }
    if (open) {
      const after = (await gql<any>(chairmanToken, PROPOSAL, { id: open.id })).marketplaceWriteoffProposal
      expect(after.items, 'состав черновика прежний').toEqual(open.items)
    }
    else {
      expect((await gql<any>(chairmanToken, OPEN_DRAFT)).marketplaceOpenWriteoffDraft, 'черновик без причины не создан').toBeNull()
    }
  })

  describe('проект до решения совета', () => {
    let memo: any
    let statement: any

    beforeAll(async () => {
      draft = (await gql<any>(chairmanToken, OPEN_DRAFT)).marketplaceOpenWriteoffDraft
      if (!draft) {
        draft = (await gql<any>(chairmanToken, CREATE_DRAFT, { d: { items: [item('Внешний тест: порча при хранении.')] } })).marketplaceCreateWriteoffDraft
        ownDraft = true
      }
      // Служебную записку по проекту, который совет ещё не утвердил, сервер не
      // выдаёт — подписываем тем же ключом председателя участка любой
      // документ проекта: отказ обязан прийти раньше проверки подписи.
      const pl = await gql<any>(chairmanToken, STATEMENT_PAYLOAD, { d: { draft_id: draft.id } })
      statement = pl.marketplaceWriteoffStatementSignablePayload
      memo = await signDocument(krgChairman.wif, statement, krgChairman.account, 1)
    })

    it(caseName('mkt.wof.side.04', 'провести списание до утверждения советом нельзя'), async () => {
      expect(draft.status, 'проект ещё не утверждён советом').toBe('DRAFT')

      const payload = await gqlError(krgToken, MEMO_PAYLOAD, { d: { braname: KRG, proposal_id: draft.id } })
      expect(payload?.code, 'служебная записка до решения совета не формируется').toBe('MARKETPLACE_WRITEOFF_NOT_AWAITING_CONFIRMATION')

      const confirm = await gqlError(krgToken, CONFIRM, { d: { braname: KRG, proposal_id: draft.id, signed_memo: memo } })
      expect(confirm?.code, 'без протокола совета списание не проводится').toBe('MARKETPLACE_WRITEOFF_NOT_AWAITING_CONFIRMATION_WITH_STATUS')

      const after = (await gql<any>(chairmanToken, PROPOSAL, { id: draft.id })).marketplaceWriteoffProposal
      expect(after.status, 'проект на прежнем этапе').toBe('DRAFT')
      expect(after.items.every((i: any) => !i.executed), 'ни одна позиция не списана').toBe(true)
    })

    it(caseName('mkt.wof.side.02', 'имущество чужого участка — председатель другого участка получает отказ доступа'), async () => {
      const payload = await gqlError(odnToken, MEMO_PAYLOAD, { d: { braname: KRG, proposal_id: draft.id } })
      expect(payload?.code, 'записку по чужому участку не выдают').toBe('MARKETPLACE_WRITEOFF_CONFIRM_NOT_TRUSTEE')

      const signed = await signDocument(odnChairman.wif, statement, odnChairman.account, 1)
      const confirm = await gqlError(odnToken, CONFIRM, { d: { braname: KRG, proposal_id: draft.id, signed_memo: signed } })
      expect(confirm?.code, 'списать имущество чужого участка нельзя').toBe('MARKETPLACE_WRITEOFF_CONFIRM_NOT_TRUSTEE')

      const after = (await gql<any>(chairmanToken, PROPOSAL, { id: draft.id })).marketplaceWriteoffProposal
      expect(after.items.every((i: any) => !i.executed), 'ни одна позиция не списана').toBe(true)
    })
  })
})

describe('кандидаты на списание: партии по происхождению', () => {
  const OFFER_NAME = 'Мёд цветочный'
  let returnedIds: string[] = []
  let receptionIds: string[] = []
  let claimStatus = ''

  beforeAll(async () => {
    const member = ROLES.member()
    const supplier = ROLES.supplier()
    const offer = await pickOffer(supplier.account, KRG, OFFER_NAME)
    const price = amount(offer.price_per_unit)
    await ensureShareFunds(member.account, price * 6 * 2, await tokenOf(member))

    // Две партии приёмки одного наименования лежат на складе участка.
    for (let i = 0; i < 2; i++) {
      const o = await prepareReceivedOrder({ member, supplier, operator: krgChairman, offerId: offer.id, quantity: 2, receivedQuantity: 2, arrivalPrice: price })
      const rows = await inventoryOfOrder(krgToken, o.orderId)
      receptionIds.push(...rows.filter(r => r.status !== 'ISSUED').map(r => r.id))
    }

    // Третий заказ выдан пайщику и возвращён им по гарантии.
    const w = await prepareReceivedOrder({ member, supplier, operator: krgChairman, offerId: offer.id, quantity: 2, receivedQuantity: 2, arrivalPrice: price })
    await issueOrder({ operator: krgChairman, member, orderId: w.orderId, actualQuantity: 2, actualUnitPrice: price })
    claimStatus = (await warrantyReturn({ member, operator: krgChairman, orderId: w.orderId, quantity: 2 })).status
    const rows = await inventoryOfOrder(krgToken, w.orderId)
    returnedIds = rows.filter(r => r.origin === 'WARRANTY_RETURN' && r.status !== 'ISSUED').map(r => r.id)
  }, 900_000)

  it(caseName('mkt.wof.side.33', 'возврат по гарантии — отдельной строкой; партии одного происхождения складываются'), async () => {
    expect(claimStatus, 'совет принял возврат (на стенде — робот)').toBe('ACCEPTED_BY_COUNCIL')
    expect(returnedIds.length, 'возвращённое имущество легло на склад участка').toBeGreaterThan(0)
    expect(receptionIds.length, 'партии приёмки на складе').toBeGreaterThanOrEqual(2)

    const list = (await gql<any>(chairmanToken, CANDIDATES)).marketplaceListWriteoffCandidates as any[]
    const returned = list.find(c => c.inventory_ids.includes(returnedIds[0]))
    const received = list.find(c => c.inventory_ids.includes(receptionIds[0]))
    expect(returned, 'гарантийный возврат среди кандидатов').toBeTruthy()
    expect(received, 'партии приёмки среди кандидатов').toBeTruthy()

    // Одно наименование, один участок, одно состояние — разница только в происхождении.
    expect(returned.braname).toBe(received.braname)
    expect(returned.asset_title).toBe(received.asset_title)
    expect(returned.is_expired).toBe(received.is_expired)
    expect(returned.expiry_date === null).toBe(received.expiry_date === null)

    expect(returned.origin, 'строка возврата помечена происхождением').toBe('WARRANTY_RETURN')
    expect(received.origin).toBe('RECEPTION')
    expect(returned.key, 'возврат не слит с приёмкой').not.toBe(received.key)
    expect(returned.inventory_ids.some((id: string) => receptionIds.includes(id)), 'в строке возврата нет партий приёмки').toBe(false)
    for (const id of returnedIds) expect(returned.inventory_ids, 'все возвращённые партии — в строке возврата').toContain(id)

    for (const id of receptionIds) expect(received.inventory_ids, 'партии одного происхождения — одной строкой').toContain(id)
    expect(received.lots_count).toBeGreaterThanOrEqual(receptionIds.length)
    expect(Number(received.quantity), 'количество строки — сумма партий').toBeGreaterThanOrEqual(4)
  })
})
