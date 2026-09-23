import { beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'

/**
 * Очистка отработавших записей (C28-78, lib/core/cleanup.hpp).
 *
 * У каждого прикладного контракта есть действие `cleanup` без аргументов: оно
 * удаляет строки, которые больше никто не прочитает, и раскатка вызывает его на
 * каждом деплое. Подписывает только сам контракт; вызов, которому нечего
 * чистить, ничего не меняет.
 */
const blockchain = new Blockchain(config.network, config.private_keys)

/** Прикладные контракты платформы: системные и тестовый `cleanup` не несут. */
const APPLICATION_CONTRACTS = config.contracts
  .map(contract => contract.target)
  .filter(name => !name.startsWith('eosio') && name !== 'test')

const TEST_REGISTRY_ID = 990_001

async function push(account: string, name: string, actor: string, data: object) {
  return blockchain.api.transact(
    { actions: [{ account, name, authorization: [{ actor, permission: 'active' }], data }] },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

async function cleanup(contract: string) {
  // Одинаковые подряд вызовы в одном блоке цепь приняла бы за повтор транзакции.
  await new Promise(resolve => setTimeout(resolve, 600))
  return push(contract, 'cleanup', contract, {})
}

async function translationsOf(registryId: number) {
  return blockchain.getTableRows('draft', 'draft', 'translations', 100, String(registryId), String(registryId), 2, 'i64')
}

beforeAll(async () => {
  await blockchain.update_pass_instance()
}, 240_000)

describe('очистка отработавших записей', () => {
  it('у каждого прикладного контракта cleanup есть и проходит на чистой цепи', async () => {
    for (const contract of APPLICATION_CONTRACTS) {
      const result = await cleanup(contract)
      expect(result.transaction_id, contract).toBeDefined()
    }
  }, 240_000)

  it('cleanup подписывает только сам контракт', async () => {
    await expect(push('soviet', 'cleanup', 'voskhod', {})).rejects.toThrow(/missing authority of soviet/)
  })

  it('перевод удалённого шаблона удаляется, повторный вызов ничего не меняет', async () => {
    await push('draft', 'createdraft', 'eosio', {
      scope: 'draft',
      username: 'eosio',
      registry_id: TEST_REGISTRY_ID,
      lang: 'ru',
      title: 'Шаблон проверки очистки',
      description: 'Заводится и удаляется тестом очистки',
      context: '<p>{{ x }}</p>',
      model: '{}',
      translation_data: '{}',
    })
    expect(await translationsOf(TEST_REGISTRY_ID)).toHaveLength(1)

    await push('draft', 'deldraft', 'eosio', { scope: 'draft', username: 'eosio', registry_id: TEST_REGISTRY_ID })
    // Удаление шаблона перевод не трогает — он остаётся сиротой.
    expect(await translationsOf(TEST_REGISTRY_ID)).toHaveLength(1)

    await cleanup('draft')
    expect(await translationsOf(TEST_REGISTRY_ID)).toHaveLength(0)

    const before = await blockchain.getTableRows('draft', 'draft', 'translations', 1000)
    await cleanup('draft')
    const after = await blockchain.getTableRows('draft', 'draft', 'translations', 1000)
    expect(after).toEqual(before)
  }, 120_000)
})
