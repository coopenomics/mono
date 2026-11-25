/**
 * Стол заказов: сводка участка для пайщика — вкладка «Стол заказов» на
 * странице кооперативного участка (test-registry/marketplace.branch-summary.yaml).
 *
 * Каждый пайщик кооператива читает по любому участку пункт выдачи с режимом
 * работы, остатки кошельков участка, итоги взносов инициаторов и движения
 * общего кошелька. Получатели, заказы и назначение движений в сводку не
 * входят: экономика участка целиком остаётся у председателя и доверенных лиц.
 *
 * Мир теста: участок krg из засева стенда — пункт выдачи; участок odn — второй
 * участок, для пайщика ekaterina чужой. Набор только читает.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ROLES, caseName, gql, gqlError, tokenOf } from '../core'
import { KRG } from './flow'
import { BRANCH_ECONOMY, branchEconomy, refusal } from './mkt-flows.helpers'

const ODN = 'odn'

const SUMMARY = `query($b:String!){ marketplaceGetBranchSummary(braname:$b){
  braname common_balance social_fund_balance
  issuance_point{ active working_hours{ mon{ open close } } }
  initiators{ money_total property_total repaid_total outstanding }
} }`
const MOVEMENTS = `query($b:String!,$o:PaginationInput){ marketplaceGetBranchSummaryMovements(braname:$b, options:$o){
  totalCount totalPages currentPage items{ global_sequence operation_code quantity created_at }
} }`
/** Поля, которые движение сводки пайщику не отдаёт: в схеме сводки их нет. */
const MOVEMENTS_WITH_RECIPIENT = `query($b:String!){ marketplaceGetBranchSummaryMovements(braname:$b){ items{ global_sequence username memo order_id } } }`
const BRANCH_HISTORY = `query($b:String!,$o:PaginationInput){ marketplaceGetBranchWalletHistory(braname:$b, options:$o){
  totalCount items{ global_sequence operation_code quantity }
} }`

let member = ''
let chairkrg = ''

beforeAll(async () => {
  member = await tokenOf(ROLES.member())
  chairkrg = await tokenOf(ROLES.branchChairman())
})

describe('Стол заказов: сводка участка для пайщика', () => {
  it(caseName('mkt.bsum.happy.01', 'пайщик читает сводку участка-пункта выдачи: режим работы и остатки кошельков те же, что у председателя участка'), async () => {
    const d = await gql<any>(member, SUMMARY, { b: KRG })
    const summary = d.marketplaceGetBranchSummary

    expect(summary.braname).toBe(KRG)
    expect(summary.issuance_point).not.toBeNull()
    expect(typeof summary.issuance_point.active).toBe('boolean')
    // Остаток общего кошелька — одно чтение цепи: у пайщика и у председателя участка число одно.
    const economy = await branchEconomy(chairkrg, KRG)
    expect(summary.common_balance).toBe(economy.common_balance)
    expect(summary.social_fund_balance).toMatch(/^\d+\.\d{4} [A-Z]+$/)
  })

  it(caseName('mkt.bsum.happy.02', 'пайщик читает сводку чужого участка: деньги участка открыты каждому пайщику кооператива'), async () => {
    const d = await gql<any>(member, SUMMARY, { b: ODN })

    expect(d.marketplaceGetBranchSummary.braname).toBe(ODN)
    expect(d.marketplaceGetBranchSummary.common_balance).toMatch(/^\d+\.\d{4} [A-Z]+$/)
  })

  it(caseName('mkt.bsum.happy.03', 'движения общего кошелька у пайщика — те же операции и суммы, что у председателя участка'), async () => {
    const o = { page: 1, limit: 20, sortOrder: 'DESC' }
    const mine = (await gql<any>(member, MOVEMENTS, { b: KRG, o })).marketplaceGetBranchSummaryMovements
    const chaired = (await gql<any>(chairkrg, BRANCH_HISTORY, { b: KRG, o })).marketplaceGetBranchWalletHistory

    expect(mine.totalCount).toBe(chaired.totalCount)
    expect(mine.items.map((i: any) => [i.global_sequence, i.operation_code, i.quantity]))
      .toEqual(chaired.items.map((i: any) => [i.global_sequence, i.operation_code, i.quantity]))
  })

  it(caseName('mkt.bsum.side.01', 'участок, которого нет среди пунктов выдачи и у которого нет инициаторов: оба раздела пусты'), async () => {
    const d = await gql<any>(member, SUMMARY, { b: 'nosuchbranch' })

    expect(d.marketplaceGetBranchSummary.issuance_point).toBeNull()
    expect(d.marketplaceGetBranchSummary.initiators).toBeNull()
  })

  it(caseName('mkt.bsum.break.01', 'получателя, назначение и заказ движение сводки не отдаёт: запрос этих полей отклонён'), async () => {
    const err = await gqlError(member, MOVEMENTS_WITH_RECIPIENT, { b: KRG })

    expect(err).not.toBeNull()
  })

  it(caseName('mkt.bsum.break.02', 'право сводки не открывает пайщику экономику участка: запрос экономики отклонён'), async () => {
    const err = await refusal(member, BRANCH_ECONOMY, { b: KRG })

    expect(['403', 'KIT_RIGHT_SCOPE_OWN_KU', 'KIT_INSUFFICIENT_RIGHTS'], err?.message).toContain(err?.codeText)
  })

  it(caseName('mkt.bsum.break.03', 'гость сводку участка и её движения не читает: отказ по входу'), async () => {
    const summary = await gqlError(null, SUMMARY, { b: KRG })
    const movements = await gqlError(null, MOVEMENTS, { b: KRG })

    expect(String(summary?.code)).toBe('401')
    expect(String(movements?.code)).toBe('401')
  })
})
