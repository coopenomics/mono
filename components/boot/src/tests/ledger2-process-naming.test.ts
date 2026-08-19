/**
 * Контрактный уровень: имя нитки процесса в ledger2 (реестр
 * ledger2.process-naming, level contract).
 *
 * Имя нитки (`process_type`) называет контракт-инициатор, а не код операции:
 * одна и та же операция в разных процессах идёт под разными именами (взнос
 * участку — ниткой поставки, его возврат — ниткой гарантийного возврата).
 * Вывести имя из кода операции нельзя, поэтому опечатка в нём ушла бы в
 * историю молча и процесс остался бы на столе бухгалтера без названия — от
 * этого и защищает гейт `is_known_process` внутри `ledger2::apply`.
 *
 * Обе проверки здесь — НАМЕРЕННО ПАДАЮЩИЕ вызовы: транзакция откатывается
 * целиком, состояние цепи не меняется, журнал не засоряется. Порядок проверок
 * внутри `apply` (код операции → имя нитки → обязательность username) выбран
 * так, чтобы каждый ассерт доказывал ровно свой гейт:
 *
 *   • неизвестное имя при ВЕРНОМ коде операции — падает на имени нитки;
 *   • известное имя — гейт имени пройден, и падение приходит уже со следующей
 *     проверки, то есть корректное имя реестром принимается.
 *
 * Положительная сторона (имя реально доезжает в данные действия рядом с кодом
 * операции) проверяется на живой цепочке Стола заказов в
 * `marketplace-money.test.ts` — там ассертится `process_type` каждой из семи
 * проводок нитки заказа.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'
import { fakeDocument } from './shared/fakeDocument'
import { waitForProcessNaming } from './shared/processNaming'
import { processLastDecision } from './soviet/processLastDecision'
import { bootstrapMember, getUserWallet, minor, programInvest } from './capital/programInvest'

const COOP = 'voskhod'
const LEDGER2 = 'ledger2'

/** Нулевой хэш: до записи в state ни один из вызовов ниже не доходит. */
const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

const bc = new Blockchain(config.network, config.private_keys)

async function sendApply(data: Record<string, unknown>) {
  return bc.api.transact({
    actions: [{
      account: LEDGER2,
      name: 'apply',
      authorization: [{ actor: COOP, permission: 'active' }],
      data,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

describe('ledger2 — имя нитки процесса (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
  }, 60_000)

  it('l2.pnam.break.01: имя нитки, которого нет в реестре процессов, отклоняется с «Unknown process type»', async () => {
    await expect(
      sendApply({
        coopname: COOP,
        initiator: COOP,
        // Код операции ВЕРНЫЙ — иначе падение пришло бы раньше, на реестре
        // операций, и про имя нитки тест не сказал бы ничего.
        operation_code: 'o.mkt.lock',
        // Опечатка в имени нитки: пропущена буква (имя обязано укладываться
        // в 13 символов eosio::name, иначе отказ придёт от сериализатора и про
        // реестр процессов тест не скажет ничего).
        process_type: 'p.mkt.suply',
        amount: '1.0000 RUB',
        username: COOP,
        process_hash: ZERO_HASH,
        memo: 'Контрактный тест: имя нитки с опечаткой не должно уйти в историю.',
      }),
    ).rejects.toThrow(/Unknown process type/i)
  }, 60_000)

  it('известное имя нитки гейт пропускает — падение приходит со следующей проверки', async () => {
    // Тот же вызов с ВЕРНЫМ именем нитки и пустым username. Кошелёк операции
    // o.mkt.lock — USER_SHARED, поэтому username обязателен; ловим именно это
    // сообщение. Значит, до проверки username вызов дошёл — имя нитки принято.
    await expect(
      sendApply({
        coopname: COOP,
        initiator: COOP,
        operation_code: 'o.mkt.lock',
        process_type: 'p.mkt.supply',
        amount: '1.0000 RUB',
        username: '',
        process_hash: ZERO_HASH,
        memo: 'Контрактный тест: верное имя нитки обязано проходить гейт реестра процессов.',
      }),
    ).rejects.toThrow(/username обязателен/i)
  }, 60_000)

  it('неизвестный код операции отклоняется раньше имени нитки — гейты не подменяют друг друга', async () => {
    // Порядок проверок внутри apply зафиксирован: реестр операций раньше
    // реестра процессов. Если бы порядок поменяли, предыдущий тест перестал бы
    // доказывать своё утверждение — фиксируем порядок явно.
    await expect(
      sendApply({
        coopname: COOP,
        initiator: COOP,
        operation_code: 'o.mkt.lockk',
        process_type: 'p.mkt.suply',
        amount: '1.0000 RUB',
        username: COOP,
        process_hash: ZERO_HASH,
        memo: 'Контрактный тест: при двух опечатках сработать обязан гейт кода операции.',
      }),
    ).rejects.toThrow(/Unknown operation code/i)
  }, 60_000)

  it('l2.pnam.side.12: при выходе из кооператива обе консолидации паевых кошельков идут ОДНИМ именем нитки', async () => {
    // Пайщик с остатками сразу на двух паевых кошельках: минимальный паевой
    // заводится при регистрации, кошелёк «Благороста» — программным взносом.
    // Именно на такой паре и проверяется случай: имя нитки не должно зависеть
    // от того, где лежали остатки.
    const member = await bootstrapMember(bc, { deposit: 200_000 })
    await programInvest(bc, member, minor(50_000))

    const minshr = await getUserWallet(bc, member, 'w.reg.minshr')
    const blago = await getUserWallet(bc, member, 'w.cap.blago')
    expect(minshr.available, 'предусловие: есть остаток на минимальном паевом').toBeGreaterThan(0)
    expect(blago.available, 'предусловие: есть остаток в ЦПП «Благорост»').toBeGreaterThan(0)

    const exitHash = generateRandomSHA256()
    await bc.api.transact({
      actions: [{
        account: 'registrator',
        name: 'exitcoop',
        authorization: [{ actor: COOP, permission: 'active' }],
        data: { coopname: COOP, username: member, exit_hash: exitHash, statement: fakeDocument },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    // Возврат паевого запускает совет: confirmexit требует авторизации soviet.
    await processLastDecision(bc, COOP)

    const naming = await waitForProcessNaming(exitHash, COOP, ['o.reg.mvmin', 'o.cap.wthcap'])

    // Обе консолидации — под именем нитки ВОЗВРАТА ПАЕВОГО ВЗНОСА. Если бы имя
    // выводилось из кода операции, у одного хэша выхода оказалось бы два имени
    // (возврат паевого и вывод из «Благороста»), и какое победит — зависело бы
    // от того, на каком кошельке у пайщика ненулевой остаток.
    expect(naming.byOperation['o.reg.mvmin'],
      'консолидация минимального паевого обязана идти ниткой возврата паевого взноса').toBe('p.wal.wthdrw')
    expect(naming.byOperation['o.cap.wthcap'],
      'консолидация «Благороста» обязана идти ТОЙ ЖЕ ниткой, хотя это операция другого контракта',
    ).toBe('p.wal.wthdrw')

    expect(naming.processType,
      'у хэша выхода обязано быть ровно одно имя нитки независимо от того, где лежали остатки',
    ).toBe('p.wal.wthdrw')
  }, 900_000)
})
