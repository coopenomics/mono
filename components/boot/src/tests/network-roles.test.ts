import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { registerCoopInSubnet } from '../init/subnet-coop'
import { generateRandomUsername } from '../utils/randomUsername'

/**
 * Роли сети в цепи (утверждены 28.11.2026).
 *
 * Ведущий — кооператив, который запустил цепь и ведёт сеть; его имя хранит
 * строка `network` реестра (`registrator::setlead`, подпись системного
 * аккаунта). Оператор — кооператив, которого ведущий назначил подключать
 * кооперативы (`registrator::appoint` / `dismiss`). Кооперативу оператором
 * записывается только кооператив из списка операторов (`setoperator`).
 *
 * Тест рассчитан на цепь стенда после boot: ведущий — `config.provider`, он
 * назначен оператором при загрузке цепи.
 */
const blockchain = new Blockchain(config.network, config.private_keys)
const lead = config.provider
const REGISTRATOR = 'registrator'

async function act(name: string, actors: string[], data: object) {
  await blockchain.update_pass_instance()
  await blockchain.api.transact(
    {
      actions: [{
        account: REGISTRATOR,
        name,
        authorization: actors.map(actor => ({ actor, permission: 'active' })),
        data,
      }],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

async function operators(): Promise<string[]> {
  const rows = await blockchain.getTableRows(REGISTRATOR, REGISTRATOR, 'operators', 1000)
  return (rows as Array<{ username: string }>).map(r => r.username)
}

async function operatorOf(coopname: string): Promise<string> {
  const rows = await blockchain.getTableRows(REGISTRATOR, REGISTRATOR, 'coops', 1, coopname, coopname)
  return String((rows[0] as { parent_username?: string } | undefined)?.parent_username ?? '')
}

// Два действующих кооператива сети: тот, кого подключают, и кандидат в операторы.
const coop = generateRandomUsername()
const candidate = generateRandomUsername()

beforeAll(async () => {
  await registerCoopInSubnet({ coopname: coop })
  await registerCoopInSubnet({ coopname: candidate })
})

describe('ведущий сети', () => {
  it('happy: системный аккаунт записывает ведущего строкой network', async () => {
    await act('setlead', ['eosio'], { lead })
    const rows = await blockchain.getTableRows(REGISTRATOR, REGISTRATOR, 'network', 1)
    expect(rows).toEqual([{ lead }])
  })

  it('break: ведущего записывает только системный аккаунт — сам ведущий записать себя не вправе', async () => {
    await expect(act('setlead', [lead], { lead })).rejects.toThrow()
  })

  it('break: ведущим не записывается имя без аккаунта в цепи', async () => {
    await expect(act('setlead', ['eosio'], { lead: 'noaccount123' })).rejects.toThrow(/REGISTRATOR_LEAD_ACCOUNT_NOT_FOUND/)
  })
})

describe('операторы сети', () => {
  it('happy: ведущий назначен оператором при загрузке цепи; повторное назначение ничего не меняет', async () => {
    expect(await operators()).toContain(lead)
    await act('appoint', [lead], { operator_name: lead })
    expect((await operators()).filter(name => name === lead)).toHaveLength(1)
  })

  it('break: оператора назначает только ведущий', async () => {
    await expect(act('appoint', [candidate], { operator_name: candidate })).rejects.toThrow()
    expect(await operators()).not.toContain(candidate)
  })

  it('break: оператором назначается только кооператив реестра', async () => {
    await expect(act('appoint', [lead], { operator_name: 'eosio' })).rejects.toThrow(/REGISTRATOR_OPERATOR_NOT_FOUND/)
  })

  it('break: кооперативу не записывается оператором кооператив вне списка операторов', async () => {
    await expect(act('setoperator', [lead], { coopname: coop, operator_name: candidate })).rejects.toThrow(/REGISTRATOR_NOT_OPERATOR/)
    expect(await operatorOf(coop)).not.toBe(candidate)
  })

  it('happy: ведущий назначает оператора — кооператив подключается к нему', async () => {
    await act('appoint', [lead], { operator_name: candidate })
    expect(await operators()).toContain(candidate)

    await act('setoperator', [lead], { coopname: coop, operator_name: candidate })
    expect(await operatorOf(coop)).toBe(candidate)
  })

  it('side: снятый оператор новые кооперативы не подключает, прежний кооператив запись об операторе сохраняет', async () => {
    await act('dismiss', [lead], { operator_name: candidate })
    expect(await operators()).not.toContain(candidate)
    expect(await operatorOf(coop)).toBe(candidate)

    // Снятый оператор вне списка: записать его оператором уже нельзя.
    await expect(act('setoperator', [lead], { coopname: candidate, operator_name: candidate })).rejects.toThrow()
    // Снять можно только назначенного: кооператив `coop` оператором не был.
    await expect(act('dismiss', [lead], { operator_name: coop })).rejects.toThrow(/REGISTRATOR_OPERATOR_NOT_APPOINTED/)

    // Кооператив возвращается к действующему оператору — ведущему.
    await act('setoperator', [lead], { coopname: coop, operator_name: lead })
    expect(await operatorOf(coop)).toBe(lead)
  })
})
