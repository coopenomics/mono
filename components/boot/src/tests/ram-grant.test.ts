import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { addUser } from '../init/participant'
import { generateRandomUsername } from '../utils/randomUsername'

/**
 * Автопополнение памяти контрактов платформы (C28-78).
 *
 * Контракт платформы непривилегированный и свою квоту узнать не может, поэтому
 * конструктор общего базового класса `coop_contract` читает у системного
 * контракта время следующей проверки (`eosio::ramwatch`) и, когда оно подошло,
 * подаёт заявку `eosio::ramreq`. Системный контракт сверяет квоту и при нехватке
 * выдаёт память бессрочно из свободного пула сети.
 *
 * Тест рассчитан на свежую цепь после boot, как и остальные тесты стенда:
 * срок следующей проверки из прошлого прогона держится час, и до него заявка
 * контракта законно ничего не выдаёт.
 */
const blockchain = new Blockchain(config.network, config.private_keys)

async function readWatch(contract: string) {
  const rows = await blockchain.getTableRows('eosio', 'eosio', 'ramwatch', 1, contract, contract)
  return rows[0] as { contract: string, next_check: string, granted_bytes: number } | undefined
}

async function readQuota(account: string): Promise<number> {
  const info = await blockchain.api.read.getAccount(account)
  return Number(info.ram_quota)
}

const GRANT_BYTES = 512 * 1024

async function readUsage(account: string): Promise<number> {
  const info = await blockchain.api.read.getAccount(account)
  return Number(info.ram_usage)
}

async function setGrant(threshold_percent: number, check_interval_sec: number, contracts: string[]) {
  await blockchain.setRamGrant({ threshold_percent, grant_bytes: GRANT_BYTES, check_interval_sec, contracts })
}

async function transact(account: string, name: string, actor: string, data: object) {
  await blockchain.api.transact(
    { actions: [{ account, name, authorization: [{ actor, permission: 'active' }], data }] },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

/** Заявка от имени контракта — так её подаёт конструктор coop_contract. */
async function ramreq(contract: string) {
  await transact('eosio', 'ramreq', contract, { contract })
}

/** Ограничить квоту памяти аккаунта (системное действие, только для неограниченных). */
async function setLimits(account: string, ram: number) {
  await transact('eosio', 'setalimits', 'eosio', { account, ram_bytes: ram, net_weight: -1, cpu_weight: -1 })
}

let originalConfig: { threshold_percent: number, grant_bytes: number, check_interval_sec: number, contracts: string[] }

beforeAll(async () => {
  await blockchain.update_pass_instance()
  const rows = await blockchain.getTableRows('eosio', 'eosio', 'ramgrantcfg', 1)
  originalConfig = rows[0]
}, 240_000)

// Тест меняет порог и интервал; настройка стенда возвращается как была.
afterAll(async () => {
  if (originalConfig)
    await blockchain.setRamGrant(originalConfig)
}, 60_000)

describe('автопополнение памяти контрактов', () => {
  it('boot выставил настройку выдачи со списком контрактов платформы', async () => {
    const rows = await blockchain.getTableRows('eosio', 'eosio', 'ramgrantcfg', 1)
    expect(rows[0]).toBeDefined()
    expect(rows[0].contracts).toContain('registrator')
    expect(rows[0].contracts).toContain('capital')
    expect(rows[0].contracts).not.toContain('eosio')
  })

  it('действие контракта подаёт заявку и получает время следующей проверки', async () => {
    // Регистрация пайщика задевает registrator; после неё у него есть строка расписания.
    await addUser(generateRandomUsername())

    const watch = await readWatch('registrator')
    expect(watch).toBeDefined()
    expect(new Date(`${watch!.next_check}Z`).getTime()).toBeGreaterThan(Date.now())
  })

  it('до срока проверки повторная заявка не подаётся', async () => {
    const before = await readWatch('registrator')
    await addUser(generateRandomUsername())
    const after = await readWatch('registrator')

    expect(after!.next_check).toBe(before!.next_check)
  })

  it('контракту с квотой выше порога сеть выдаёт память бессрочно', async () => {
    // На стенде квоты контрактов не ограничены, а неограниченному контракту
    // выдавать нечего. Берём контракт, который почти не пишет, и ограничиваем
    // его квоту чуть выше занятого — так он заведомо выше порога.
    const target = 'loan'
    const used = await readUsage(target)
    await setLimits(target, used + 20_000)
    await setGrant(70, 1, [target])

    const quotaBefore = await readQuota(target)
    await ramreq(target)

    expect(await readQuota(target) - quotaBefore).toBe(GRANT_BYTES)
    expect((await readWatch(target))!.granted_bytes).toBe(GRANT_BYTES)
  })

  it('до срока следующей проверки заявка ничего не выдаёт', async () => {
    const target = 'loan'
    await setGrant(1, 3600, [target])
    await new Promise(resolve => setTimeout(resolve, 1500))
    await ramreq(target) // срок из прошлого теста вышел — эта заявка проходит и ставит срок на час

    const before = await readWatch(target)
    const quotaBefore = await readQuota(target)
    // Пауза, чтобы повторная заявка не совпала с первой байт в байт: узел
    // отбросил бы её как дубликат транзакции, и проверка ничего бы не доказала.
    await new Promise(resolve => setTimeout(resolve, 1500))
    await ramreq(target)

    expect(await readWatch(target)).toEqual(before)
    expect(await readQuota(target)).toBe(quotaBefore)
  })

  it('контракт не из списка памяти не получает, а заявка проходит без отказа', async () => {
    // Квота ограничена и занята выше порога: будь контракт в списке, он получил бы память.
    const target = 'ano'
    await setLimits(target, await readUsage(target) + 20_000)
    await setGrant(1, 1, ['capital'])
    const quotaBefore = await readQuota(target)

    await ramreq(target)

    expect(await readQuota(target)).toBe(quotaBefore)
    expect((await readWatch(target))!.granted_bytes).toBe(0)
  })
})
