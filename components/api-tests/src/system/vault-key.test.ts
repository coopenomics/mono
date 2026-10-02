/**
 * Серверное хранилище ключа (test-registry/system.vault-key.yaml).
 *
 * Узел подписывает транзакции ключом, который лежит у него зашифрованным.
 * Сохранить ключ можно только свой: сервер сверяет его с действующим ключом
 * аккаунта в цепи. Чужой или испорченный ключ хранилище не принимает.
 *
 * Мир теста: свежий пайщик с собственным ключом и ключ пайщика-соседа.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, caseName, expectCode, freshMember, gql, gqlError, tokenOf } from '../core'

const SET_WIF = 'mutation($d:SetWifInput!){ setWif(data:$d) }'

let owner: Who
let neighbour: Who

beforeAll(() => {
  owner = freshMember({ prefix: 'vlt' })
  neighbour = freshMember({ prefix: 'vln' })
}, 300_000)

describe('Серверное хранилище ключа', () => {
  it(caseName('sys.vault.happy.01', 'свой действующий ключ хранилище принимает; повторное сохранение — без ошибки'), async () => {
    expect((await gql<any>(null, SET_WIF, { d: { username: owner.account, wif: owner.wif, permission: 'active' } })).setWif).toBe(true)
    expect((await gql<any>(null, SET_WIF, { d: { username: owner.account, wif: owner.wif } })).setWif).toBe(true)
    // Вход тем же ключом после сохранения проходит как прежде.
    expect(await tokenOf(owner)).toBeTruthy()
  })

  it(caseName('sys.vault.side.01', 'чужой ключ для аккаунта хранилище не принимает'), async () => {
    expectCode(await gqlError(null, SET_WIF, { d: { username: owner.account, wif: neighbour.wif } }), 'AUTH_INVALID_PRIVATE_KEY')
  })

  it(caseName('sys.vault.side.02', 'строка, которая не разбирается как ключ, — отказ ввода, а не сбой сервера'), async () => {
    const err = await gqlError(null, SET_WIF, { d: { username: owner.account, wif: 'это не ключ' } })
    expectCode(err, 'AUTH_INVALID_PRIVATE_KEY')
  })

  it(caseName('sys.vault.side.03', 'ключ кооператива и ключ председателя чужим ключом не подменить'), async () => {
    for (const username of [COOP, CHAIRMAN.account])
      expectCode(await gqlError(null, SET_WIF, { d: { username, wif: neighbour.wif } }), 'AUTH_INVALID_PRIVATE_KEY')
  })
})
