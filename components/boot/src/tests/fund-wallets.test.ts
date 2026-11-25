/**
 * Контрактный уровень: реестр фондов кооператива на кошельках ledger2
 * (задача 99D-25; реестр fund.wallets, случаи fnd.wal.*).
 *
 * Проверяется на живой цепи стенда:
 *   • `funds` — пять стандартных фондов с кошельками; фонды накопления — с
 *     процентами, фонды списания — без; таблиц прежнего учёта остатков нет;
 *   • editfund председателем — описание и процент меняются; сумма процентов
 *     выше 100 % — FUND_PERCENT_SUM_EXCEEDED; процент у фонда списания —
 *     FUND_PERCENT_INVALID; чужое название — FUND_NAME_FIXED; несуществующий
 *     номер — FUND_NOT_FOUND; не председатель — FUND_NOT_CHAIRMAN;
 *   • createfund / delfund — FUND_FUNDS_FIXED: набор фондов фиксирован;
 *   • реестр кошельков ledger2 знает пять кошельков фондов на счёте 86 и не
 *     знает общего кошелька с разрезом.
 *
 * Отчисления в фонды накопления тремя операциями проверяет набор
 * marketplace-period.test.ts (прогон первого числа). После теста проценты
 * фондов возвращаются к исходным.
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FundContract, Ledger2 } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { CHAIRMAN, COOP, fromState } from './marketplace/chainHelpers'

// Председатель подписывает editfund сам: его ключ добавляется к ключам стенда.
const bc = new Blockchain(config.network, [...config.private_keys, CHAIRMAN.wif])

const FUND = FundContract.contractName.production
const ekaterina = fromState('ekaterina')

const ACCUM = 'accumulation'
const EXPEND = 'expend'

const EXPECTED_WALLETS: Record<number, string> = {
  1: 'w.fnd.indiv',
  2: 'w.fnd.resrv',
  3: 'w.fnd.devel',
  4: 'w.sov.expns',
  5: 'w.fnd.mutual',
}

let pushSeq = 0

async function pushAs(actor: string, name: string, data: Record<string, unknown>) {
  return bc.api.transact(
    { actions: [{ account: FUND, name, authorization: [{ actor, permission: 'active' }], data }] },
    // Свой срок жизни у каждой транзакции: повтор одинакового действия в одном
    // блоке nodeos иначе отбросит как duplicate transaction до ответа контракта.
    { blocksBehind: 3, expireSeconds: 30 + (pushSeq++ % 600) },
  )
}

async function funds(): Promise<any[]> {
  const rows: any[] = await bc.getTableRows(FUND, COOP, 'funds', 20)
  return rows.sort((a, b) => Number(a.id) - Number(b.id))
}

function editArgs(row: any, patch: Partial<{ type: string, name: string, description: string, percent: number, contract: string }> = {}) {
  return {
    coopname: COOP,
    username: CHAIRMAN.account,
    type: row.kind === 'accum' ? ACCUM : EXPEND,
    fund_id: Number(row.id),
    contract: '',
    name: row.name,
    description: row.description,
    percent: Number(row.percent),
    ...patch,
  }
}

let initial: any[] = []

describe('фонды кооператива — реестр настроек и кошельки ledger2 (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    initial = await funds()
    expect(initial.length, 'пять стандартных фондов заведены сидом стенда').toBe(5)
  }, 60_000)

  afterAll(async () => {
    // Возвращаем проценты и описания фондов к исходным.
    for (const row of initial) {
      await pushAs(CHAIRMAN.account, 'editfund', editArgs(row)).catch(() => {})
    }
  })

  it('funds: пять фондов с кошельками, проценты только у фондов накопления, таблиц прежнего учёта нет', async () => {
    for (const row of initial) {
      expect(row.wallet, `кошелёк фонда ${row.id}`).toBe(EXPECTED_WALLETS[Number(row.id)])
      if (Number(row.id) <= 3) {
        expect(row.kind).toBe('accum')
        expect(Number(row.percent) > 0, `процент фонда накопления ${row.name}`).toBe(true)
      } else {
        expect(row.kind).toBe('expend')
        expect(Number(row.percent)).toBe(0)
      }
    }
    const sum = initial.reduce((s, f) => s + Number(f.percent), 0)
    expect(sum <= 1_000_000, 'сумма процентов не выше 100 %').toBe(true)

    for (const table of ['accfunds', 'expfunds', 'coopwallet', 'fwithdraws']) {
      const rows: any[] = await bc.getTableRows(FUND, COOP, table, 10).catch(() => [])
      expect(rows, `таблица прежнего учёта ${table} пуста`).toEqual([])
    }
  })

  it('реестр кошельков ledger2: пять кошельков фондов на счёте 86, общего кошелька с разрезом нет', () => {
    const registry = Ledger2.LEDGER2_WALLET_REGISTRY
    for (const wallet of Object.values(EXPECTED_WALLETS)) {
      const meta = registry.find(w => w.name === wallet)
      expect(meta, `кошелёк ${wallet} в реестре`).toBeDefined()
      expect(meta?.kind).toBe('COOPERATIVE')
      expect(meta?.account, `счёт кошелька ${wallet}`).toBe(86_000)
    }
    expect(registry.find(w => w.name === 'w.fnd.accum')).toBeUndefined()
  })

  it('editfund: председатель меняет описание и процент; отказы с кодами', async () => {
    const reserve = initial.find(f => Number(f.id) === 2)
    await pushAs(CHAIRMAN.account, 'editfund', editArgs(reserve, { description: 'Резерв на непредвиденные расходы', percent: 160_000 }))
    const after = (await funds()).find(f => Number(f.id) === 2)
    expect(after.description).toBe('Резерв на непредвиденные расходы')
    expect(Number(after.percent)).toBe(160_000)

    // Сумма процентов выше 100 %: остальные фонды дают 6 %, этот — 95 %.
    await expect(pushAs(CHAIRMAN.account, 'editfund', editArgs(reserve, { percent: 950_000 })))
      .rejects.toThrow(/FUND_PERCENT_SUM_EXCEEDED/)
    // Нулевой процент у фонда накопления.
    await expect(pushAs(CHAIRMAN.account, 'editfund', editArgs(reserve, { percent: 0 })))
      .rejects.toThrow(/FUND_PERCENT_INVALID/)
    // Название стандартного фонда не меняется.
    await expect(pushAs(CHAIRMAN.account, 'editfund', editArgs(reserve, { name: 'Другой фонд' })))
      .rejects.toThrow(/FUND_NAME_FIXED/)
    // Вид в вызове расходится с видом фонда.
    await expect(pushAs(CHAIRMAN.account, 'editfund', editArgs(reserve, { type: EXPEND, percent: 0 })))
      .rejects.toThrow(/FUND_KIND_MISMATCH/)
    // Несуществующий номер.
    await expect(pushAs(CHAIRMAN.account, 'editfund', { ...editArgs(reserve), fund_id: 42 }))
      .rejects.toThrow(/FUND_NOT_FOUND/)

    // Фонд списания: процент не задаётся, описание меняется.
    const mutual = initial.find(f => Number(f.id) === 5)
    await expect(pushAs(CHAIRMAN.account, 'editfund', editArgs(mutual, { percent: 10_000 })))
      .rejects.toThrow(/FUND_PERCENT_INVALID/)
    await pushAs(CHAIRMAN.account, 'editfund', editArgs(mutual, { description: 'Материальная помощь пайщикам' }))
    expect((await funds()).find(f => Number(f.id) === 5).description).toBe('Материальная помощь пайщикам')
  }, 120_000)

  it('editfund не председателем — FUND_NOT_CHAIRMAN', async () => {
    const reserve = initial.find(f => Number(f.id) === 2)
    const keyed = new Blockchain(config.network, [...config.private_keys, ekaterina.wif])
    await keyed.update_pass_instance()
    await expect(keyed.api.transact(
      { actions: [{ account: FUND, name: 'editfund', authorization: [{ actor: ekaterina.account, permission: 'active' }],
        data: { ...editArgs(reserve), username: ekaterina.account } }] },
      { blocksBehind: 3, expireSeconds: 30 + (pushSeq++ % 600) },
    )).rejects.toThrow(/FUND_NOT_CHAIRMAN/)
  })

  it('createfund / delfund — набор фондов фиксирован: FUND_FUNDS_FIXED', async () => {
    await expect(pushAs(CHAIRMAN.account, 'createfund', {
      coopname: COOP, username: CHAIRMAN.account, type: ACCUM, contract: '',
      name: 'Фонд совета', description: '', percent: 10_000,
    })).rejects.toThrow(/FUND_FUNDS_FIXED/)
    await expect(pushAs(CHAIRMAN.account, 'delfund', {
      coopname: COOP, username: CHAIRMAN.account, type: EXPEND, fund_id: 5,
    })).rejects.toThrow(/FUND_FUNDS_FIXED/)
    expect((await funds()).length, 'фондов по-прежнему пять').toBe(5)
  })
})
