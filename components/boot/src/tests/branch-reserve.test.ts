/**
 * Контрактный уровень: резерв социально-экономического обеспечения пайщиков и
 * потолок материальной помощи (задача 99D-20, КЭУ-2; реестр
 * marketplace.order, случаи mkt.order.keu.*).
 *
 * Проверяется на живой цепи стенда:
 *   • setaidlimit — потолок резерва на получателя в месяц, синглтон brnconfig;
 *   • setreserve — строка резерва председателю участка; отказы: выше потолка,
 *     посторонний пайщик, нулевая сумма;
 *   • createaid — заявление в пределах накопленного права получателя проходит
 *     и уменьшает право в строке резерва; сверх права отклоняется
 *     BRANCH_AID_OVER_RESERVE (задача 99D-34: право копится каждый период и не
 *     сгорает);
 *   • setaidperiod — длина месяца предела помощи: меньше минуты — отказ,
 *     при длине 600 с право начисляется по номеру отрезка от эпохи; при длине
 *     60 с через период право больше суммы строки — невзятое не сгорело;
 *   • delreserve — строка стирается, заявление без резерва отклоняется
 *     BRANCH_AID_NO_RESERVE.
 *
 * Суммы крошечные: заявление проходит на 1 ₽, чтобы накопитель за реальный
 * месяц UTC не упёрся в резерв за тысячу прогонов. Заявление остаётся на
 * повестке совета стенда и не выплачивается, но сумму контракт переводит при
 * подаче: с персонального кошелька получателя на кошелёк заявлений, а если его
 * не хватает — из свободных средств инициаторов. Поэтому перед заявлением тест
 * обеспечивает средства (ensureAidFunds). После теста потолок
 * возвращается в ноль: иначе остальные наборы стенда, подающие материальную
 * помощь, потребовали бы резерва.
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness (участок krg
 * и его председатель chairkrg).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BranchContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'
import { COOP, fromState, loginAs } from './marketplace/chainHelpers'
import { aidStatement, ensureAidFunds } from './marketplace/investHelpers'
import { rub } from './marketplace/periodHelpers'

const bc = new Blockchain(config.network, config.private_keys)

const BRANAME = 'krg'
const LIMIT = '1000.0000 RUB'
const RESERVE = '1000.0000 RUB'
const SMALL_AID = '1.0000 RUB'

const chairkrg = fromState('chairkrg')
const ekaterina = fromState('ekaterina')

const BRANCH = BranchContract.contractName.production

let pushSeq = 0

async function push(name: string, data: Record<string, unknown>) {
  return bc.api.transact(
    { actions: [{ account: BRANCH, name, authorization: [{ actor: COOP, permission: 'active' }], data }] },
    // Срок жизни у каждой транзакции свой: повтор одинакового действия в том же блоке
    // nodeos иначе отбросит как duplicate transaction, не дав контракту ответить кодом.
    { blocksBehind: 3, expireSeconds: 30 + (pushSeq++ % 600) },
  )
}

async function rows(table: string, limit = 200): Promise<any[]> {
  return bc.getTableRows(BRANCH, COOP, table, limit)
}

let chairkrgToken = ''

/** Заявление на 1 RUB проходит, только если на него есть средства: персональный кошелёк либо средства инициаторов. */
async function fundSmallAid() {
  await ensureAidFunds(bc, chairkrg, chairkrg, chairkrgToken, BRANAME, rub(1))
}

describe('экономика участка — резерв социально-экономического обеспечения и предел материальной помощи (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    chairkrgToken = await loginAs(chairkrg)
    const branches = await rows('branches')
    const krg = branches.find((b: any) => b.braname === BRANAME)
    expect(krg, 'участок krg заведён сидом стенда').toBeDefined()
    expect(krg.trustee, 'председатель участка krg — chairkrg').toBe(chairkrg.account)
    // Начальное состояние: без строки резерва у председателя.
    const reserves = await rows('reserves')
    if (reserves.some((r: any) => r.braname === BRANAME && r.username === chairkrg.account)) {
      await push('delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account })
    }
  }, 60_000)

  afterAll(async () => {
    // Возвращаем стенд в прежнее состояние: резерв снят, потолок ноль.
    await push('delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account }).catch(() => {})
    await push('setaidlimit', { coopname: COOP, limit: '0.0000 RUB' })
  })

  it('setaidlimit: потолок резерва записывается в настройки участков; отрицательный отклоняется', async () => {
    await push('setaidlimit', { coopname: COOP, limit: LIMIT })
    const cfg = await rows('brnconfig', 1)
    expect(cfg[0]?.aid_month_limit).toBe(LIMIT)
    await expect(push('setaidlimit', { coopname: COOP, limit: '-1.0000 RUB' })).rejects.toThrow(/BRANCH_AID_LIMIT_INVALID/)
  })

  it('setreserve: председателю — строка; выше потолка, постороннему и на ноль — отказы с кодом', async () => {
    await push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: RESERVE })
    const reserves = await rows('reserves')
    const row = reserves.find((r: any) => r.braname === BRANAME && r.username === chairkrg.account)
    expect(row?.amount).toBe(RESERVE)

    await expect(push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: '1500.0000 RUB' }))
      .rejects.toThrow(/BRANCH_RESERVE_OVER_LIMIT/)
    await expect(push('setreserve', { coopname: COOP, braname: BRANAME, username: ekaterina.account, amount: '10.0000 RUB' }))
      .rejects.toThrow(/BRANCH_RESERVE_NOT_TRUSTED/)
    await expect(push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: '0.0000 RUB' }))
      .rejects.toThrow(/BRANCH_RESERVE_AMOUNT_INVALID/)
  })

  it('setreserve: повторная запись перезаписывает сумму, строка одна', async () => {
    await push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: '500.0000 RUB' })
    await push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: RESERVE })
    const mine = (await rows('reserves')).filter((r: any) => r.braname === BRANAME && r.username === chairkrg.account)
    expect(mine.length).toBe(1)
    expect(mine[0].amount).toBe(RESERVE)
  })

  /** Строка резерва председателя участка krg. */
  async function myReserve(): Promise<any> {
    return (await rows('reserves')).find((r: any) => r.braname === BRANAME && r.username === chairkrg.account)
  }

  it('createaid: в пределах накопленного права проходит и уменьшает право; сверх права — BRANCH_AID_OVER_RESERVE (99D-34)', async () => {
    const before = await myReserve()
    expect(before?.accrued_period, 'строка резерва ведёт накопленное право').toBeDefined()
    await fundSmallAid()
    const hash = generateRandomSHA256()
    await push('createaid', {
      coopname: COOP,
      username: chairkrg.account,
      braname: BRANAME,
      aid_hash: hash,
      amount: SMALL_AID,
      statement: aidStatement(chairkrg, hash),
      meta: '{}',
    })
    const after = await myReserve()
    // Право на период заявления: остаток прошлой записи плюс сумма строки за прошедшие периоды, минус заявление.
    const gap = Number(after.accrued_period) - Number(before.accrued_period)
    const expected = Number.parseFloat(before.outstanding) + Number.parseFloat(RESERVE) * gap - 1
    expect(Number.parseFloat(after.outstanding)).toBeCloseTo(expected, 4)

    // Сверх права: остаток плюс начисление одного периода с запасом — на случай, если период сменится до отправки.
    const over = Number.parseFloat(after.outstanding) + Number.parseFloat(RESERVE) + 0.5
    const overHash = generateRandomSHA256()
    await expect(push('createaid', {
      coopname: COOP,
      username: chairkrg.account,
      braname: BRANAME,
      aid_hash: overHash,
      amount: `${over.toFixed(4)} RUB`,
      statement: aidStatement(chairkrg, overHash),
      meta: '{}',
    })).rejects.toThrow(/BRANCH_AID_OVER_RESERVE/)
  })

  it('снятие и новая запись резерва в том же периоде не возвращают израсходованное право', async () => {
    // Дыра ревью 10.11.2026: новая строка начинала с полной суммы, и получатель
    // мог подать заявление, снять резерв, записать заново и подать ещё раз.
    const before = await myReserve()
    const month = (await rows('aidmonths')).find((r: any) => r.username === chairkrg.account)
    expect(month, 'накопитель поданного за период ведётся').toBeDefined()
    const used = Number.parseFloat(month.total)
    expect(used, 'заявление из прошлого случая учтено в накопителе').toBeGreaterThan(0)

    await push('delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account })
    await push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: RESERVE })
    const after = await myReserve()
    // Период мог смениться между заявлением и новой записью — тогда новая строка
    // по праву начинает с полной суммы; сравнение идёт только внутри одного периода.
    if (Number(after.accrued_period) === Number(month.period) && Number(before.accrued_period) === Number(month.period)) {
      const expected = Math.max(0, Number.parseFloat(RESERVE) - used)
      expect(Number.parseFloat(after.outstanding), 'право новой строки — сумма минус уже поданное').toBeCloseTo(expected, 4)
      const over = expected + 0.5
      const hash = generateRandomSHA256()
      await expect(push('createaid', {
        coopname: COOP,
        username: chairkrg.account,
        braname: BRANAME,
        aid_hash: hash,
        amount: `${over.toFixed(4)} RUB`,
        statement: aidStatement(chairkrg, hash),
        meta: '{}',
      })).rejects.toThrow(/BRANCH_AID_OVER_RESERVE/)
    }
  })

  it('setaidperiod: меньше минуты — отказ; при 600 с право начисляется по номеру отрезка; при 60 с через период право больше суммы строки — невзятое не сгорает; ноль — календарный месяц', async () => {
    const before = (await rows('brnconfig', 1))[0]
    const prev = Number(before?.aid_period_seconds ?? 0)
    await expect(push('setaidperiod', { coopname: COOP, seconds: 30 })).rejects.toThrow(/BRANCH_AID_PERIOD_INVALID/)
    try {
      await push('setaidperiod', { coopname: COOP, seconds: 600 })
      expect(Number((await rows('brnconfig', 1))[0]?.aid_period_seconds)).toBe(600)
      // Потолок не тронут: длина периода пишется в ту же строку настроек.
      expect((await rows('brnconfig', 1))[0]?.aid_month_limit).toBe(LIMIT)

      await fundSmallAid()
      const hash = generateRandomSHA256()
      const from = Math.floor(Date.now() / 1000 / 600)
      await push('createaid', {
        coopname: COOP,
        username: chairkrg.account,
        braname: BRANAME,
        aid_hash: hash,
        amount: SMALL_AID,
        statement: aidStatement(chairkrg, hash),
        meta: '{}',
      })
      const to = Math.floor(Date.now() / 1000 / 600)
      const row = await myReserve()
      expect(Number(row.accrued_period), 'номер периода — отрезок 600 с от эпохи').toBeGreaterThanOrEqual(from)
      expect(Number(row.accrued_period)).toBeLessThanOrEqual(to)

      // Право копится: строка 10 ₽ в период 60 с; через период заявление на 15 ₽ проходит.
      await push('setaidperiod', { coopname: COOP, seconds: 60 })
      await push('delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account })
      await push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: '10.0000 RUB' })
      const anchored = Number((await myReserve()).accrued_period)
      while (Math.floor(Date.now() / 1000 / 60) <= anchored) await new Promise((r) => setTimeout(r, 2_000)) // timing: schedule — ждём смены периода стенда в цепи
      await ensureAidFunds(bc, chairkrg, chairkrg, chairkrgToken, BRANAME, rub(15))
      const accHash = generateRandomSHA256()
      await push('createaid', {
        coopname: COOP,
        username: chairkrg.account,
        braname: BRANAME,
        aid_hash: accHash,
        amount: '15.0000 RUB',
        statement: aidStatement(chairkrg, accHash),
        meta: '{}',
      })
      expect(Number.parseFloat((await myReserve()).outstanding), 'осталось право двух периодов минус заявление').toBeGreaterThanOrEqual(5)

      await push('setaidperiod', { coopname: COOP, seconds: 0 })
      expect(Number((await rows('brnconfig', 1))[0]?.aid_period_seconds)).toBe(0)
    }
    finally {
      await push('setaidperiod', { coopname: COOP, seconds: prev })
      await push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: RESERVE }).catch(() => {})
    }
  }, 180_000)

  it('delreserve: строка стирается, заявление без резерва отклоняется BRANCH_AID_NO_RESERVE', async () => {
    await push('delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account })
    const mine = (await rows('reserves')).filter((r: any) => r.braname === BRANAME && r.username === chairkrg.account)
    expect(mine.length).toBe(0)
    await expect(push('delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account }))
      .rejects.toThrow(/BRANCH_RESERVE_NOT_FOUND/)

    const hash = generateRandomSHA256()
    await expect(push('createaid', {
      coopname: COOP,
      username: chairkrg.account,
      braname: BRANAME,
      aid_hash: hash,
      amount: SMALL_AID,
      statement: aidStatement(chairkrg, hash),
      meta: '{}',
    })).rejects.toThrow(/BRANCH_AID_NO_RESERVE/)
  })

  it('потолок ноль: резерв завести нельзя (BRANCH_RESERVE_DISABLED), материальная помощь без предела', async () => {
    await push('setaidlimit', { coopname: COOP, limit: '0.0000 RUB' })
    await expect(push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: '10.0000 RUB' }))
      .rejects.toThrow(/BRANCH_RESERVE_DISABLED/)
    await fundSmallAid()
    const hash = generateRandomSHA256()
    await push('createaid', {
      coopname: COOP,
      username: chairkrg.account,
      braname: BRANAME,
      aid_hash: hash,
      amount: SMALL_AID,
      statement: aidStatement(chairkrg, hash),
      meta: '{}',
    })
  })
})
