/**
 * Экономика кооперативного участка (реестр marketplace.economy): общий
 * кошелёк членских взносов, плановый резерв, сетка весов доверенных,
 * распределение и заявление на материальную помощь — снаружи, через API.
 *
 * Набор ведёт свой заказ до выдачи: членский взнос с него оседает в общем
 * кошельке участка krg, из него и распределяется. Сетка весов участка krg
 * задаётся здесь же от лица председателя участка. Суммы сверяются приращениями
 * — стенд общий, на нём работают и другие наборы.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  CHAIRMAN,
  COOP,
  COOP_SIGNER,
  ROLES,
  amount,
  caseName,
  gql,
  signDocument,
  tableRows,
  tokenOf,
  transact,
  waitFor,
} from '../core'
import { KRG, pickOffer } from './flow'
import { type BranchEconomy, branchEconomy, issuedOrder, personalOf, refusal } from './mkt-flows.helpers'

const ODN = 'odn'
const TRUSTED_KRG = 'trustedkrg'

/**
 * Ставка налога на доходы физических лиц (Россия) — её берёт справочник
 * юрисдикций @coopenomics/jurisdictions. Налог округляется до целого рубля.
 */
const NDFL_RATE_PERCENT = 13

const DISTRIBUTE = 'mutation($d:MarketplaceDistributeBranchFundsInput!){ marketplaceDistributeBranchFunds(data:$d) }'
const SET_WEIGHT = 'mutation($d:MarketplaceSetTrusteeWeightInput!){ marketplaceSetTrusteeWeight(data:$d) }'
const DEL_WEIGHT = 'mutation($d:MarketplaceDeleteTrusteeWeightInput!){ marketplaceDeleteTrusteeWeight(data:$d) }'
const CREATE_PLAN = 'mutation($d:CreateExpensePlanInput!){ createExpensePlan(data:$d){ id amount } }'
const DELETE_PLAN = 'mutation($d:DeleteExpensePlanInput!){ deleteExpensePlan(data:$d) }'

const chairkrg = ROLES.branchChairman()
const chairodn = ROLES.foreignBranchChairman()
const ekaterina = ROLES.member()
const sidorov = ROLES.supplier()

let krgToken = ''
let odnToken = ''
let memberToken = ''
let chairmanToken = ''

/** Плановые расходы, заведённые набором, — снимаются в конце. */
const plans: { token: string, id: number }[] = []

function days(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString()
}

async function createPlan(token: string, braname: string, sum: number, dueInDays: number): Promise<number> {
  const d = await gql<any>(token, CREATE_PLAN, {
    d: { braname, title: `Внешний слой: плановый расход ${sum}`, amount: sum, due_date: days(dueInDays), pay_to: 'Получатель по договору, р/с 40702810000000000001' },
  })
  const id = Number(d.createExpensePlan.id)
  plans.push({ token, id })
  return id
}

async function deletePlan(token: string, id: number): Promise<void> {
  await gql(token, DELETE_PLAN, { d: { plan_id: id } })
  const i = plans.findIndex(p => p.id === id)
  if (i >= 0)
    plans.splice(i, 1)
}

/** Сетка участка по «marketplace» как множество «имя:вес» — для сравнения до/после. */
function grid(eco: BranchEconomy): string {
  return eco.weights.map(w => `${w.username}:${w.weight}`).sort().join(',')
}

describe('экономика участка: общий кошелёк, сетка, распределение, материальная помощь', () => {
  beforeAll(async () => {
    krgToken = await tokenOf(chairkrg)
    odnToken = await tokenOf(chairodn)
    memberToken = await tokenOf(ekaterina)
    chairmanToken = await tokenOf(CHAIRMAN)

    // Членский взнос с выданного заказа оседает в общем кошельке участка выдачи.
    const before = amount((await branchEconomy(krgToken, KRG)).common_balance)
    const offer = await pickOffer(sidorov.account, KRG, 'Мёд цветочный')
    await issuedOrder({ member: ekaterina, supplier: sidorov, operator: chairkrg, offer, quantity: 3 })
    const after = amount((await branchEconomy(krgToken, KRG)).common_balance)
    expect(after, 'членский взнос с выданного заказа обязан попасть в общий кошелёк участка').toBeGreaterThan(before)
  }, 900_000)

  afterAll(async () => {
    for (const p of [...plans]) await deletePlan(p.token, p.id).catch(() => {})
  })

  it(caseName('mkt.eco.side.07', 'без своей ставки действует умолчание 30%, ставка вне 0…100 на цепь не уходит'), async () => {
    const q = 'query{ marketplaceGetEconomyConfig{ membership_fee_percent } }'
    const current = (await gql<any>(chairmanToken, q)).marketplaceGetEconomyConfig.membership_fee_percent as number

    // Своя ставка кооператива живёт в синглтоне marketplace::config; пока его
    // нет, контракт и бэкенд считают по общему умолчанию 30%.
    const rows = await tableRows<any>('marketplace', COOP, 'config')
    const expected = rows.length ? Number(rows[0].membership_fee_percent) / 10_000 : 30
    expect(current, rows.length ? 'ставка из конфигурации цепи' : 'умолчание ставки — 30%').toBeCloseTo(expected, 6)

    for (const bad of [-1, 100.5, 250]) {
      const err = await refusal(chairmanToken, 'mutation($d:MarketplaceSetMembershipFeeInput!){ marketplaceSetMembershipFee(data:$d){ membership_fee_percent } }', { d: { membership_fee_percent: bad } })
      expect(err, `ставка ${bad}% обязана быть отклонена`).not.toBeNull()
      expect(['400', '422', 'MARKETPLACE_ECONOMY_PERCENT_OUT_OF_RANGE'], `код отказа ставки ${bad}%: ${err?.message}`).toContain(err!.codeText)
    }
    const after = (await gql<any>(chairmanToken, q)).marketplaceGetEconomyConfig.membership_fee_percent
    expect(after, 'отклонённая ставка не меняет действующую').toBeCloseTo(current, 6)
    const rowsAfter = await tableRows<any>('marketplace', COOP, 'config')
    expect(JSON.stringify(rowsAfter), 'конфигурация на цепи не тронута').toBe(JSON.stringify(rows))
  })

  it(caseName('mkt.eco.side.03', 'распределение при ненастроенной сетке весов — отказ'), async () => {
    const eco = await branchEconomy(odnToken, ODN)
    expect(eco.total_weight, 'предусловие: сетка участка odn не настроена').toBe(0)
    const err = await refusal(odnToken, DISTRIBUTE, { d: { braname: ODN, amount: 1 } })
    expect(err?.codeText, err?.message).toBe('MARKETPLACE_DISTRIBUTION_NOT_CONFIGURED')
    expect((await branchEconomy(odnToken, ODN)).common_balance).toBe(eco.common_balance)
  })

  it(caseName('mkt.eco.side.08', 'резерв больше остатка общего кошелька — доступно ноль, а не минус'), async () => {
    const before = await branchEconomy(odnToken, ODN)
    const common = amount(before.common_balance)
    const planId = await createPlan(odnToken, ODN, Math.round(common) + 500, 3)
    try {
      const eco = await branchEconomy(odnToken, ODN)
      expect(amount(eco.reserve_amount), 'резерв включает срочный плановый расход').toBeGreaterThan(common)
      expect(eco.available_to_distribute, 'доступно к распределению — ноль').toMatch(/^0\.0+ /)
      expect(amount(eco.available_to_distribute)).toBe(0)
    }
    finally {
      await deletePlan(odnToken, planId)
    }
  })

  let nearPlan = 0

  it(caseName('mkt.eco.happy.01', 'общий кошелёк, резерв ближайших 30 дней и доступное показаны раздельно'), async () => {
    const before = await branchEconomy(krgToken, KRG)
    nearPlan = await createPlan(krgToken, KRG, 40, 5)
    const farPlan = await createPlan(krgToken, KRG, 70, 60)

    const eco = await branchEconomy(krgToken, KRG)
    expect(eco.braname).toBe(KRG)
    expect(amount(eco.reserve_amount) - amount(before.reserve_amount), 'в резерв входит только расход со сроком внутри 30 дней').toBeCloseTo(40, 4)
    expect(eco.common_balance, 'резерв не списывает деньги с общего кошелька').toBe(before.common_balance)
    const expected = Math.max(0, amount(eco.common_balance) - amount(eco.reserve_amount))
    expect(amount(eco.available_to_distribute), 'доступно = общий кошелёк − резерв').toBeCloseTo(expected, 4)

    await deletePlan(krgToken, farPlan)
  })

  it(caseName('mkt.eco.happy.02', 'доли доверенных — вес / Σ весов, рядом их персональные кошельки'), async () => {
    await gql(krgToken, SET_WEIGHT, { d: { braname: KRG, username: chairkrg.account, weight: 3 } })
    await gql(krgToken, SET_WEIGHT, { d: { braname: KRG, username: TRUSTED_KRG, weight: 1 } })

    const eco = await branchEconomy(krgToken, KRG)
    const chair = eco.weights.find(w => w.username === chairkrg.account)
    const trusted = eco.weights.find(w => w.username === TRUSTED_KRG)
    expect(chair?.weight).toBe(3)
    expect(trusted?.weight).toBe(1)
    expect(eco.total_weight, 'Σ весов — сумма сетки').toBe(eco.weights.reduce((s, w) => s + w.weight, 0))
    for (const w of eco.weights)
      expect(w.share_percent, `доля ${w.username}`).toBeCloseTo(w.weight * 100 / eco.total_weight, 6)
    expect(eco.weights.reduce((s, w) => s + w.share_percent, 0), 'доли складываются в 100%').toBeCloseTo(100, 6)

    // Персональный кошелёк рядом с долей — тот же, что доверенный видит у себя.
    const own = await gql<any>(krgToken, 'query{ marketplaceGetPersonalEconomy{ personal_balance } }')
    expect(chair?.personal_balance).toBe(own.marketplaceGetPersonalEconomy.personal_balance)
  })

  it(caseName('mkt.eco.side.06', 'дробный, нулевой вес и вес от чужого председателя — отказ, сетка не меняется'), async () => {
    const before = grid(await branchEconomy(krgToken, KRG))

    for (const weight of [1.5, 0, -2]) {
      const err = await refusal(krgToken, SET_WEIGHT, { d: { braname: KRG, username: TRUSTED_KRG, weight } })
      expect(err, `вес ${weight} обязан быть отклонён`).not.toBeNull()
      expect(['400', '422', 'BAD_USER_INPUT', 'GRAPHQL_VALIDATION_FAILED', 'MARKETPLACE_DISTRIBUTION_WEIGHT_INVALID'], `код отказа веса ${weight}: ${err?.message}`).toContain(err!.codeText)
    }

    const foreignSet = await refusal(odnToken, SET_WEIGHT, { d: { braname: KRG, username: TRUSTED_KRG, weight: 9 } })
    expect(foreignSet?.codeText, foreignSet?.message).toBe('MARKETPLACE_DISTRIBUTION_SETTINGS_FORBIDDEN')
    const foreignDel = await refusal(odnToken, DEL_WEIGHT, { d: { braname: KRG, username: TRUSTED_KRG } })
    expect(foreignDel?.codeText, foreignDel?.message).toBe('MARKETPLACE_DISTRIBUTION_SETTINGS_FORBIDDEN')

    expect(grid(await branchEconomy(krgToken, KRG)), 'сетка участка не изменилась').toBe(before)
  })

  it(caseName('mkt.eco.side.05', 'в сетку участка попадают только его веса по «marketplace»'), async () => {
    const before = await branchEconomy(krgToken, KRG)
    // Вес того же председателя у другого контракта-источника (капитализация) —
    // запись в том же реестре branch::weights, ставится прямо в цепи.
    await transact(COOP_SIGNER, [{ account: 'branch', name: 'setweight', data: { coopname: COOP, braname: KRG, contract: 'capital', username: chairkrg.account, weight: 7 } }])
    // Вес на соседнем участке — через API его председателем.
    await gql(odnToken, SET_WEIGHT, { d: { braname: ODN, username: chairodn.account, weight: 5 } })
    try {
      await waitFor(async () => {
        const rows = await tableRows<any>('branch', COOP, 'weights')
        return rows.some(r => r.contract === 'capital' && r.braname === KRG) ? true : null
      }, { label: 'вес капитализации в реестре весов' })

      const eco = await branchEconomy(krgToken, KRG)
      expect(grid(eco), 'сетка krg по «marketplace» прежняя').toBe(grid(before))
      expect(eco.total_weight, 'Σ весов не включает веса другого контракта').toBe(before.total_weight)
      expect(eco.weights.map(w => w.username)).not.toContain(chairodn.account)
      expect(eco.weights.find(w => w.username === chairkrg.account)?.weight, 'вес председателя — по «marketplace», не 7 от капитализации').toBe(3)

      const odn = await branchEconomy(odnToken, ODN)
      expect(grid(odn), 'у соседнего участка своя сетка').toBe(`${chairodn.account}:5`)
    }
    finally {
      await transact(COOP_SIGNER, [{ account: 'branch', name: 'delweight', data: { coopname: COOP, braname: KRG, contract: 'capital', username: chairkrg.account } }]).catch(() => {})
      await gql(odnToken, DEL_WEIGHT, { d: { braname: ODN, username: chairodn.account } }).catch(() => {})
    }
  })

  it(caseName('mkt.eco.side.04', 'нулевая или отрицательная сумма распределения — отказ, на цепь ничего не уходит'), async () => {
    const before = await branchEconomy(krgToken, KRG)
    for (const sum of [0, -5]) {
      const err = await refusal(krgToken, DISTRIBUTE, { d: { braname: KRG, amount: sum } })
      expect(err, `сумма ${sum} обязана быть отклонена`).not.toBeNull()
      expect(['400', '422', 'MARKETPLACE_DISTRIBUTION_AMOUNT_MUST_BE_POSITIVE'], `код отказа суммы ${sum}: ${err?.message}`).toContain(err!.codeText)
    }
    const after = await branchEconomy(krgToken, KRG)
    expect(after.common_balance).toBe(before.common_balance)
    expect(after.weights.map(w => w.personal_balance)).toEqual(before.weights.map(w => w.personal_balance))
  })

  it(caseName('mkt.eco.side.02', 'распределение не председателем этого участка — отказ, сетка и кошельки прежние'), async () => {
    const before = await branchEconomy(krgToken, KRG)

    const foreign = await refusal(odnToken, DISTRIBUTE, { d: { braname: KRG, amount: 1 } })
    expect(foreign?.codeText, foreign?.message).toBe('MARKETPLACE_DISTRIBUTION_SETTINGS_FORBIDDEN')
    // Обычный пайщик участка распределять не вправе вовсе.
    const member = await refusal(memberToken, DISTRIBUTE, { d: { braname: KRG, amount: 1 } })
    expect(['403', 'MARKETPLACE_DISTRIBUTION_SETTINGS_FORBIDDEN', 'KIT_INSUFFICIENT_RIGHTS'], member?.message).toContain(member?.codeText)

    const after = await branchEconomy(krgToken, KRG)
    expect(after.common_balance).toBe(before.common_balance)
    expect(grid(after)).toBe(grid(before))
    expect(after.weights.map(w => w.personal_balance)).toEqual(before.weights.map(w => w.personal_balance))
  })

  it(caseName('mkt.eco.side.01', 'распределение, задевающее резерв, — отказ с остатком, резервом и доступной суммой'), async () => {
    const eco = await branchEconomy(krgToken, KRG)
    expect(amount(eco.reserve_amount), 'предусловие: у участка есть плановый резерв').toBeGreaterThan(0)
    const tooMuch = amount(eco.available_to_distribute) + 1
    const err = await refusal(krgToken, DISTRIBUTE, { d: { braname: KRG, amount: tooMuch } })
    expect(err?.codeText, err?.message).toBe('400')
    expect(err!.message, 'отказ называет остаток общего кошелька').toContain(eco.common_balance)
    expect(err!.message, 'отказ называет резерв').toContain(eco.reserve_amount)
    expect(err!.message, 'отказ называет доступную сумму').toContain(eco.available_to_distribute)

    const after = await branchEconomy(krgToken, KRG)
    expect(after.common_balance, 'на цепь ничего не ушло').toBe(eco.common_balance)
    expect(after.weights.map(w => w.personal_balance)).toEqual(eco.weights.map(w => w.personal_balance))
  })

  const DISTRIBUTED = 200

  it(caseName('mkt.eco.happy.03', 'председатель участка распределяет доступную сумму по сетке'), async () => {
    await deletePlan(krgToken, nearPlan)
    const before = await branchEconomy(krgToken, KRG)
    expect(amount(before.available_to_distribute), 'предусловие: доступно не меньше распределяемого').toBeGreaterThanOrEqual(DISTRIBUTED)

    const ok = await gql<any>(krgToken, DISTRIBUTE, { d: { braname: KRG, amount: DISTRIBUTED } })
    expect(ok.marketplaceDistributeBranchFunds).toBe(true)

    const after = await branchEconomy(krgToken, KRG)
    // Контракт раскладывает сумму долями вниз до копейки; остаток округления
    // остаётся в общем кошельке.
    let paid = 0
    for (const w of before.weights) {
      const share = Math.floor(DISTRIBUTED * 10_000 * w.weight / before.total_weight) / 10_000
      paid += share
      expect(personalOf(after, w.username) - personalOf(before, w.username), `доля ${w.username} (вес ${w.weight} из ${before.total_weight})`).toBeCloseTo(share, 4)
    }
    expect(amount(before.common_balance) - amount(after.common_balance), 'общий кошелёк уменьшился на разложенную сумму').toBeCloseTo(paid, 4)
    expect(paid).toBeGreaterThan(DISTRIBUTED - 0.01)

    // Распределение видно в движениях общего кошелька участка изъятиями по долям.
    const h = await gql<any>(krgToken, `query($b:String!,$o:PaginationInput){ marketplaceGetBranchWalletHistory(braname:$b, options:$o){ items{ operation_code quantity } } }`, { b: KRG, o: { page: 1, limit: 20, sortOrder: 'DESC' } })
    const releases = (h.marketplaceGetBranchWalletHistory.items as any[]).filter(i => i.operation_code === 'o.brn.release').map(i => amount(i.quantity))
    for (const w of before.weights) {
      const share = Math.floor(DISTRIBUTED * 10_000 * w.weight / before.total_weight) / 10_000
      expect(releases.some(r => Math.abs(r - share) < 0.00005), `изъятие доли ${share} из общего кошелька`).toBe(true)
    }
  })

  let methodId = ''

  async function submitAid(sum: number): Promise<{ aidHash: string }> {
    if (!methodId) {
      const m = await gql<any>(krgToken, 'mutation($d:AddPaymentMethodInput!){ addPaymentMethod(data:$d){ method_id } }', {
        d: {
          username: chairkrg.account,
          is_default: false,
          bank_transfer_data: {
            account_number: '40817810099910004312',
            bank_name: 'ПАО Сбербанк',
            currency: 'RUB',
            details: { bik: '044525225', corr: '30101810400000000225' },
          },
        },
      })
      methodId = m.addPaymentMethod.method_id
    }
    const pl = await gql<any>(krgToken, `query($d:MarketplaceAidStatementSignablePayloadInput!){
      marketplaceAidStatementSignablePayload(data:$d){ full_title html hash meta binary }
    }`, { d: { braname: KRG, amount: sum } })
    const doc = pl.marketplaceAidStatementSignablePayload
    const meta = typeof doc.meta === 'string' ? JSON.parse(doc.meta) : doc.meta
    const aidHash = String(meta.aid_hash)
    expect(aidHash).toMatch(/^[0-9a-f]{64}$/)
    const signed = await signDocument(chairkrg.wif, doc, chairkrg.account, 1)
    const r = await gql<any>(krgToken, 'mutation($d:MarketplaceCreateAidInput!){ marketplaceCreateAid(data:$d) }', {
      d: { braname: KRG, amount: sum, aid_hash: aidHash, statement: signed, payment_method_id: methodId },
    })
    expect(r.marketplaceCreateAid).toBe(true)
    return { aidHash }
  }

  async function cashierPayment(aidHash: string): Promise<any> {
    const d = await gql<any>(chairmanToken, `query($d:PaymentFiltersInput,$o:PaginationInput){
      getPayments(data:$d, options:$o){ items{ hash quantity status type username } }
    }`, { d: { hash: aidHash }, o: { page: 1, limit: 5, sortOrder: 'DESC' } })
    return (d.getPayments.items as any[]).find(p => String(p.hash).toLowerCase() === aidHash.toLowerCase())
  }

  function ndfl(gross: number): number {
    // Половина рубля и больше округляется вверх (НК РФ, ст. 52 п. 6).
    return Math.floor((Math.round(gross * 10_000) * NDFL_RATE_PERCENT + 500_000) / 1_000_000)
  }

  it(caseName('mkt.eco.happy.04', 'заявление на материальную помощь — на сумму до налога, кассиру за вычетом налога'), async () => {
    const gross = 100
    expect(personalOf(await branchEconomy(krgToken, KRG), chairkrg.account), 'предусловие: персональных средств хватает').toBeGreaterThanOrEqual(gross)
    const { aidHash } = await submitAid(gross)

    // Заявление на повестке совета — на всю сумму: её спишут с персонального
    // кошелька при выплате.
    const aids = await gql<any>(krgToken, 'query{ marketplaceListAids{ hash username braname amount stage } }')
    const aid = (aids.marketplaceListAids as any[]).find(a => a.hash.toLowerCase() === aidHash)
    expect(aid, 'заявление видно доверенному').toBeTruthy()
    expect(aid.username).toBe(chairkrg.account)
    expect(amount(aid.amount), 'заявление — на всю сумму до налога').toBeCloseTo(gross, 4)
    expect(aid.stage).toBe('ON_COUNCIL')

    // Платёж кассиру выставлен заранее — на сумму за вычетом налога.
    const payment = await cashierPayment(aidHash)
    expect(payment, 'платёж материальной помощи в реестре кассира').toBeTruthy()
    expect(payment.username).toBe(chairkrg.account)
    expect(payment.quantity, 'кассиру — сумма за вычетом налога').toBeCloseTo(gross - ndfl(gross), 4)
    expect(payment.quantity, '100 ₽ − 13 ₽ налога').toBeCloseTo(87, 4)
  })

  it(caseName('mkt.eco.side.10', 'сумма не кратна рублю: налог округлён до рубля, платёж кассиру с копейками регистрируется'), async () => {
    // До 25.09.2026 сумма платежа хранилась целым числом, и выплата 87,50 ₽
    // падала «invalid input syntax for type integer».
    const gross = 100.5
    expect(personalOf(await branchEconomy(krgToken, KRG), chairkrg.account), 'предусловие: персональных средств хватает').toBeGreaterThanOrEqual(gross)
    const { aidHash } = await submitAid(gross)
    const payment = await cashierPayment(aidHash)
    expect(payment, 'платёж материальной помощи в реестре кассира').toBeTruthy()
    expect(ndfl(gross), 'налог 13,065 ₽ округлён до 13 ₽').toBe(13)
    expect(payment.quantity, '100,50 ₽ − 13 ₽ налога').toBeCloseTo(87.5, 4)
  })
})
