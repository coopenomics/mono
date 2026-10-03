/**
 * Серверное хранилище ключа (test-registry/system.vault-key.yaml).
 *
 * Узел подписывает транзакции ключом кооператива, который лежит у него
 * зашифрованным. Сохранить можно только ключ кооператива, и только
 * действующий: сервер сверяет его с ключом аккаунта в цепи. Личные ключи
 * пайщиков хранилище не принимает.
 *
 * Мир теста: ключ кооператива стенда и свежий пайщик с собственным ключом.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COOP_SIGNER, caseName, expectCode, freshMember, gql, gqlError, tokenOf } from '../core'

const SET_WIF = 'mutation($d:SetWifInput!){ setWif(data:$d) }'

let member: Who

beforeAll(() => {
  member = freshMember({ prefix: 'vlt' })
}, 300_000)

describe('Серверное хранилище ключа', () => {
  it(caseName('sys.vault.happy.01', 'действующий ключ кооператива хранилище принимает; повторное сохранение — без ошибки'), async () => {
    expect((await gql<any>(null, SET_WIF, { d: { username: COOP, wif: COOP_SIGNER.wif, permission: 'active' } })).setWif).toBe(true)
    expect((await gql<any>(null, SET_WIF, { d: { username: COOP, wif: COOP_SIGNER.wif } })).setWif).toBe(true)
    // Узел подписывает как прежде: вход и операции стенда после сохранения работают.
    expect(await tokenOf(CHAIRMAN)).toBeTruthy()
  })

  it(caseName('sys.vault.side.01', 'чужой ключ для аккаунта кооператива хранилище не принимает'), async () => {
    expectCode(await gqlError(null, SET_WIF, { d: { username: COOP, wif: member.wif } }), 'AUTH_INVALID_PRIVATE_KEY')
  })

  it(caseName('sys.vault.side.02', 'строка, которая не разбирается как ключ, — отказ ввода, а не сбой сервера'), async () => {
    expectCode(await gqlError(null, SET_WIF, { d: { username: COOP, wif: 'это не ключ' } }), 'AUTH_INVALID_PRIVATE_KEY')
  })

  it(caseName('sys.vault.side.04', 'личный ключ пайщика или председателя хранилище не принимает, даже верный'), async () => {
    // До 03.10.2026 хранилище принимало верный ключ любого аккаунта цепи (C28-85).
    expectCode(await gqlError(null, SET_WIF, { d: { username: member.account, wif: member.wif } }), 'SYSTEM_VAULT_COOPERATIVE_KEY_ONLY')
    expectCode(await gqlError(null, SET_WIF, { d: { username: CHAIRMAN.account, wif: CHAIRMAN.wif } }), 'SYSTEM_VAULT_COOPERATIVE_KEY_ONLY')
    // Вход пайщика своим ключом от этого не зависит.
    expect(await tokenOf(member)).toBeTruthy()
  })
})
