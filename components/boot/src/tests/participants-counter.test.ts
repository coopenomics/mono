import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { addUser } from '../init/participant'
import { generateRandomUsername } from '../utils/randomUsername'

/**
 * Счётчик активных пайщиков кооператива и минимальные взносы ранних пайщиков
 * (C28-42, 09.11.2026).
 *
 * Счётчик `registrator::coops.active_participants_count` — знаменатель кворума
 * общего собрания (meet::vote). Его ведут приращения: приём прибавляет,
 * блокировка вычитает. До исправления разблокировка обратно не прибавляла, и у
 * ВОСХОДа на боевой цепи счётчик разошёлся с реестром (45 при 46 пайщиках с
 * правом голоса). Здесь проверяется:
 *   • блокировка и разблокировка возвращают счётчик к исходному числу;
 *   • повторная разблокировка активного пайщика счётчик не трогает;
 *   • registrator::migrate пересчитывает счётчик по реестру совета и повторный
 *     прогон ничего не меняет;
 *   • ledger2::migrate на цепи без кошелька w.sov.mnused не трогает
 *     минимальные взносы (перенос ранних пайщиков ВОСХОДа касается только
 *     боевой цепи, где этот кошелёк есть).
 *
 * Запускать на поднятом стенде: нужен кооператив voskhod с председателем ant.
 */
const COOP = config.provider
const CHAIRMAN = config.provider_chairman
// Ключа председателя у тестов стенда нет; блокировку и разблокировку контракт
// принимает и от самого совета (check_auth_and_get_payer_or_fail({_soviet, admin})).
const SOVIET = 'soviet'
const blockchain = new Blockchain(config.network, config.private_keys)

// Одинаковые подряд транзакции в одном блоке цепь приняла бы за повтор:
// у каждой свой срок действия.
let txSeq = 0
async function push(account: string, name: string, actor: string, data: object) {
  txSeq = (txSeq + 1) % 600
  return blockchain.api.transact(
    { actions: [{ account, name, authorization: [{ actor, permission: 'active' }], data }] },
    { blocksBehind: 3, expireSeconds: 30 + txSeq },
  )
}

async function counter(): Promise<number> {
  const rows = await blockchain.getTableRows('registrator', 'registrator', 'coops', 1, COOP, COOP)
  return Number(rows[0].active_participants_count)
}

/** Сколько пайщиков в реестре совета принято и с правом голоса — истина для счётчика. */
async function votersInRegistry(): Promise<number> {
  const rows = await blockchain.getTableRows('soviet', COOP, 'participants', 10_000)
  return rows.filter((p: any) => p.status === 'accepted' && Number(p.has_vote) === 1).length
}

async function minShareState() {
  const wallets = await blockchain.getTableRows('ledger2', COOP, 'wallets', 1000)
  const userWallets = await blockchain.getTableRows('ledger2', COOP, 'userwallets', 10_000)
  return {
    l2: wallets.find((w: any) => w.id === 'w.reg.minshr') ?? null,
    l3: userWallets.filter((w: any) => w.wallet_name === 'w.reg.minshr'),
  }
}

let PARTICIPANT = ''

beforeAll(async () => {
  await blockchain.update_pass_instance()
  // Пересчёт выравнивает счётчик стенда перед проверками приращений:
  // на стенде он мог разойтись ещё до исправления разблокировки.
  await push('registrator', 'migrate', 'registrator', {})
  PARTICIPANT = generateRandomUsername()
  await addUser(PARTICIPANT)
}, 240_000)

describe('счётчик активных пайщиков', () => {
  it('блокировка вычитает пайщика, разблокировка возвращает', async () => {
    const before = await counter()

    await push('soviet', 'block', SOVIET, { coopname: COOP, admin: CHAIRMAN, username: PARTICIPANT, message: 'проверка счётчика' })
    expect(await counter()).toBe(before - 1)

    await push('soviet', 'unblock', SOVIET, { coopname: COOP, admin: CHAIRMAN, username: PARTICIPANT, is_registration: false, message: 'проверка счётчика' })
    expect(await counter()).toBe(before)
    expect(await counter()).toBe(await votersInRegistry())
  }, 120_000)

  it('повторная разблокировка активного пайщика счётчик не меняет', async () => {
    const before = await counter()
    await push('soviet', 'unblock', SOVIET, { coopname: COOP, admin: CHAIRMAN, username: PARTICIPANT, is_registration: false, message: 'повтор' })
    expect(await counter()).toBe(before)
  }, 60_000)

  it('разблокировка несуществующего пайщика отклоняется с кодом', async () => {
    await expect(
      push('soviet', 'unblock', SOVIET, { coopname: COOP, admin: CHAIRMAN, username: 'nobodyhere12', is_registration: false, message: 'нет такого' }),
    ).rejects.toThrow(/SOVIET_PARTICIPANT_NOT_FOUND/)
  }, 60_000)

  it('incparticpnt подписывает только soviet', async () => {
    await expect(
      push('registrator', 'incparticpnt', COOP, { coopname: COOP, username: PARTICIPANT }),
    ).rejects.toThrow(/missing authority of soviet/)
  }, 60_000)

  it('registrator::migrate сводит счётчик с реестром совета, повтор ничего не меняет', async () => {
    await push('registrator', 'migrate', 'registrator', {})
    const first = await counter()
    expect(first).toBe(await votersInRegistry())

    await push('registrator', 'migrate', 'registrator', {})
    expect(await counter()).toBe(first)
  }, 120_000)
})

describe('минимальные взносы ранних пайщиков', () => {
  it('ledger2::migrate без кошелька w.sov.mnused минимальные взносы не трогает', async () => {
    const wallets = await blockchain.getTableRows('ledger2', COOP, 'wallets', 1000)
    expect(wallets.find((w: any) => w.id === 'w.sov.mnused')).toBeUndefined()

    const before = await minShareState()
    await push('ledger2', 'migrate', 'ledger2', {})
    expect(await minShareState()).toEqual(before)
  }, 120_000)
})
