/**
 * Журнал движения позиции склада и архив склада (реестр marketplace.stock,
 * решение владельца 19.11.2026).
 *
 * Набор проводит заказ через приёмку и выдачу на участке krg и читает через
 * API то, что видит оператор в карточке позиции и на вкладке «Архив»:
 *   - журнал начинается приёмкой и заканчивается выдачей; принял и выдал
 *     оператор участка, получатель — пайщик заказа;
 *   - выданная позиция лежит в архиве участка;
 *   - председатель чужого участка журнал позиции krg не читает и в архиве её
 *     не видит (реестр marketplace.branch-scope).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ROLES, caseName, gql, tokenOf } from '../core'
import { KRG, pickOffer } from './flow'
import { issuedOrder, refusal } from './mkt-flows.helpers'
import { inventoryOfOrder } from './stock.helpers'

const PRODUCT = 'Мёд цветочный'
const NOT_TRUSTEE = 'KIT_RIGHT_SCOPE_OWN_KU'

const MOVEMENTS = `query($id:String!){ marketplaceInventoryMovements(inventory_id:$id){
  id kind at actor_account actor_name branch_name place_label quantity barcode_value order_id recipient_account recipient_name
} }`
const ARCHIVE = `query($d:MarketplaceListInventoryArchiveInput, $o:PaginationInput){
  marketplaceListInventoryArchive(data:$d, options:$o){ items{ id status braname } totalCount totalPages currentPage }
}`

const member = ROLES.member()
const supplier = ROLES.supplier()
const operator = ROLES.branchChairman()
const foreign = ROLES.foreignBranchChairman()

let operatorToken = ''
let foreignToken = ''

describe('Стол заказов: журнал движения позиции и архив склада', () => {
  let orderId = ''
  let itemId = ''

  beforeAll(async () => {
    operatorToken = await tokenOf(operator)
    foreignToken = await tokenOf(foreign)
    const offer = await pickOffer(supplier.account, KRG, PRODUCT)
    const issued = await issuedOrder({ member, supplier, operator, offer, quantity: 1 })
    orderId = issued.orderId
    const rows = await inventoryOfOrder(operatorToken, orderId)
    expect(rows.length, 'выданный заказ оставил позицию склада').toBeGreaterThan(0)
    itemId = rows[0].id
    expect(rows[0].status).toBe('ISSUED')
  }, 1_200_000)

  it(caseName('mkt.stock.journal.01', 'журнал позиции: приёмка первой, выдача последней, получатель — пайщик заказа'), async () => {
    const d = await gql<any>(operatorToken, MOVEMENTS, { id: itemId })
    const steps = d.marketplaceInventoryMovements as any[]
    expect(steps.length, 'в журнале есть шаги').toBeGreaterThanOrEqual(2)

    const first = steps[0]
    expect(first.kind).toBe('RECEIVED')
    expect(first.actor_account, 'принял оператор участка').toBe(operator.account)
    expect(first.order_id).toBe(orderId)

    const last = steps[steps.length - 1]
    expect(last.kind).toBe('ISSUED')
    expect(last.actor_account, 'выдал оператор участка').toBe(operator.account)
    expect(last.recipient_account, 'получил пайщик заказа').toBe(member.account)

    const times = steps.map(s => new Date(s.at).getTime())
    expect([...times].sort((a, b) => a - b), 'шаги идут по времени').toEqual(times)
  })

  it(caseName('mkt.stock.archive.01', 'выданная позиция — в архиве своего участка, чужому участку не видна'), async () => {
    const d = await gql<any>(operatorToken, ARCHIVE, { d: { braname: KRG }, o: { page: 1, limit: 100 } })
    const page = d.marketplaceListInventoryArchive
    expect(page.currentPage).toBe(1)
    expect(page.items.length).toBeLessThanOrEqual(100)
    expect((page.items as any[]).every(i => i.braname === KRG), 'только участок krg').toBe(true)
    expect((page.items as any[]).every(i => i.status === 'ISSUED' || i.status === 'WRITTEN_OFF'), 'только выданное и списанное').toBe(true)
    expect((page.items as any[]).some(i => i.id === itemId), 'выданная позиция в архиве (свежее сверху)').toBe(true)
  })

  it(caseName('mkt.scope.side.08', 'председатель чужого участка не читает журнал позиции krg и не видит её в архиве'), async () => {
    const deniedJournal = await refusal(foreignToken, MOVEMENTS, { id: itemId })
    expect(deniedJournal?.codeText, `чужой участок не читает журнал: ${deniedJournal?.message}`).toBe(NOT_TRUSTEE)

    const denied = await refusal(foreignToken, ARCHIVE, { d: { braname: KRG } })
    if (!denied) {
      const own = await gql<any>(foreignToken, ARCHIVE, { d: null, o: { page: 1, limit: 100 } })
      expect((own.marketplaceListInventoryArchive.items as any[]).some(i => i.id === itemId), 'чужой участок позицию krg не видит').toBe(false)
    }
    else {
      expect(denied.codeText, denied.message).toBe(NOT_TRUSTEE)
    }
  })
})
