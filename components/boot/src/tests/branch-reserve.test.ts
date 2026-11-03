/**
 * Контрактный уровень: резерв социально-экономического обеспечения пайщиков и
 * потолок материальной помощи (задача 99D-20, КЭУ-2; реестр
 * marketplace.order, случаи mkt.order.keu.*).
 *
 * Проверяется на живой цепи стенда:
 *   • setaidlimit — потолок резерва на получателя в месяц, синглтон brnconfig;
 *   • setreserve — строка резерва председателю участка; отказы: выше потолка,
 *     посторонний пайщик, нулевая сумма;
 *   • createaid — заявление в пределах резерва проходит и пишется в накопитель
 *     aidmonths; заявление сверх резерва отклоняется BRANCH_AID_OVER_RESERVE;
 *   • delreserve — строка стирается, заявление без резерва отклоняется
 *     BRANCH_AID_NO_RESERVE.
 *
 * Суммы крошечные: заявление проходит на 1 ₽, чтобы накопитель за реальный
 * месяц UTC не упёрся в резерв за тысячу прогонов. Заявление остаётся на
 * повестке совета стенда — оно никуда не выплачивается. После теста потолок
 * возвращается в ноль: иначе остальные наборы стенда, подающие материальную
 * помощь, потребовали бы резерва.
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness (участок krg
 * и его председатель chairkrg).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import ecc from 'eosjs-ecc'
import { BranchContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'
import { COOP, fromState } from './marketplace/chainHelpers'

const bc = new Blockchain(config.network, config.private_keys)

const BRANAME = 'krg'
const LIMIT = '1000.0000 RUB'
const RESERVE = '1000.0000 RUB'
const SMALL_AID = '1.0000 RUB'
const OVER_AID = '999.5000 RUB'

const chairkrg = fromState('chairkrg')
const ekaterina = fromState('ekaterina')

const BRANCH = BranchContract.contractName.production

async function push(name: string, data: Record<string, unknown>) {
  return bc.api.transact(
    { actions: [{ account: BRANCH, name, authorization: [{ actor: COOP, permission: 'active' }], data }] },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

async function rows(table: string, limit = 200): Promise<any[]> {
  return bc.getTableRows(BRANCH, COOP, table, limit)
}

/** Заявление на материальную помощь, подписанное ключом получателя (контракт сверяет ключ подписанта). */
function statementBy(who: { wif: string, account: string }, hash: string) {
  return {
    version: '1.0.0',
    hash,
    doc_hash: hash,
    meta_hash: hash,
    meta: '{}',
    signatures: [{
      id: 1,
      signed_hash: hash,
      signer: who.account,
      public_key: ecc.privateToPublic(who.wif),
      signature: ecc.signHash(hash, who.wif),
      signed_at: new Date().toISOString().slice(0, 19),
    }],
  }
}

describe('экономика участка — резерв социально-экономического обеспечения и предел материальной помощи (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
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

  it('createaid: в пределах резерва проходит и пишется в накопитель месяца; сверх резерва — BRANCH_AID_OVER_RESERVE', async () => {
    const before = (await rows('aidmonths')).find((m: any) => m.username === chairkrg.account)
    const hash = generateRandomSHA256()
    await push('createaid', {
      coopname: COOP, username: chairkrg.account, braname: BRANAME, aid_hash: hash,
      amount: SMALL_AID, statement: statementBy(chairkrg, hash), meta: '{}',
    })
    const after = (await rows('aidmonths')).find((m: any) => m.username === chairkrg.account)
    expect(after, 'накопитель месяца появился').toBeDefined()
    const prev = before && before.period === after.period ? Number.parseFloat(before.total) : 0
    expect(Number.parseFloat(after.total)).toBeCloseTo(prev + 1, 4)

    const overHash = generateRandomSHA256()
    await expect(push('createaid', {
      coopname: COOP, username: chairkrg.account, braname: BRANAME, aid_hash: overHash,
      amount: OVER_AID, statement: statementBy(chairkrg, overHash), meta: '{}',
    })).rejects.toThrow(/BRANCH_AID_OVER_RESERVE/)
  })

  it('delreserve: строка стирается, заявление без резерва отклоняется BRANCH_AID_NO_RESERVE', async () => {
    await push('delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account })
    const mine = (await rows('reserves')).filter((r: any) => r.braname === BRANAME && r.username === chairkrg.account)
    expect(mine.length).toBe(0)
    await expect(push('delreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account }))
      .rejects.toThrow(/BRANCH_RESERVE_NOT_FOUND/)

    const hash = generateRandomSHA256()
    await expect(push('createaid', {
      coopname: COOP, username: chairkrg.account, braname: BRANAME, aid_hash: hash,
      amount: SMALL_AID, statement: statementBy(chairkrg, hash), meta: '{}',
    })).rejects.toThrow(/BRANCH_AID_NO_RESERVE/)
  })

  it('потолок ноль: резерв завести нельзя (BRANCH_RESERVE_DISABLED), материальная помощь без предела', async () => {
    await push('setaidlimit', { coopname: COOP, limit: '0.0000 RUB' })
    await expect(push('setreserve', { coopname: COOP, braname: BRANAME, username: chairkrg.account, amount: '10.0000 RUB' }))
      .rejects.toThrow(/BRANCH_RESERVE_DISABLED/)
    const hash = generateRandomSHA256()
    await push('createaid', {
      coopname: COOP, username: chairkrg.account, braname: BRANAME, aid_hash: hash,
      amount: SMALL_AID, statement: statementBy(chairkrg, hash), meta: '{}',
    })
  })
})
