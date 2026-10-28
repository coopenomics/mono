import type { PostgresFactoryStorage } from '../src/Storage'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cooperative } from 'cooptypes'
import { Generator } from '../src'
import { coopname, generator, testStorage } from './utils'

beforeAll(async () => {
  await generator.connect(testStorage())
})

beforeEach(async () => {
  // Очистка записей udata перед каждым тестом
  const storage = generator.storage as PostgresFactoryStorage
  if (storage)
    await storage.db.deleteFrom('factory_records').where('collection', '=', 'udatas').execute()
})

describe('тест модели пользовательских данных (udata)', () => {
  it('сохранение, извлечение и удаление пользовательских данных', async () => {
    const udata1 = {
      coopname: 'voskhod',
      username: 'testuser1',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
      value: 'test value 1',
      metadata: { additional: 'data1' },
    }

    const udata2 = {
      coopname: 'voskhod',
      username: 'testuser1',
      key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER,
      value: 'test value 2',
      metadata: { additional: 'data2' },
    }

    const udata3 = {
      coopname: 'voskhod',
      username: 'testuser2',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
      value: 'test value 3',
      metadata: { additional: 'data3' },
    }

    // Сохраняем данные
    const saved1 = await generator.save('udata', udata1)
    const saved2 = await generator.save('udata', udata2)
    const saved3 = await generator.save('udata', udata3)

    expect(saved1.insertedId).toBeDefined()
    expect(saved2.insertedId).toBeDefined()
    expect(saved3.insertedId).toBeDefined()

    // Извлекаем конкретные данные
    const retrieved1 = await generator.get('udata', {
      coopname: 'voskhod',
      username: 'testuser1',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
    }) as any

    const retrieved2 = await generator.get('udata', {
      coopname: 'voskhod',
      username: 'testuser1',
      key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER,
    }) as any

    const retrieved3 = await generator.get('udata', {
      coopname: 'voskhod',
      username: 'testuser2',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
    }) as any

    // Проверяем, что данные извлечены корректно
    expect(retrieved1.value).toEqual('test value 1')
    expect(retrieved1.metadata.additional).toEqual('data1')
    expect(retrieved1.deleted).toEqual(false)
    expect(retrieved1.block_num).toBeDefined()
    expect(String(retrieved1._id)).toEqual(saved1.insertedId)

    expect(retrieved2.value).toEqual('test value 2')
    expect(retrieved2.metadata.additional).toEqual('data2')
    expect(retrieved2.deleted).toEqual(false)
    expect(retrieved2.block_num).toBeDefined()
    expect(String(retrieved2._id)).toEqual(saved2.insertedId)

    expect(retrieved3.value).toEqual('test value 3')
    expect(retrieved3.metadata.additional).toEqual('data3')
    expect(retrieved3.deleted).toEqual(false)
    expect(retrieved3.block_num).toBeDefined()
    expect(String(retrieved3._id)).toEqual(saved3.insertedId)

    // Проверяем получение списка данных
    const udataList1 = await generator.list('udata', { coopname: 'voskhod', username: 'testuser1' })
    const udataList2 = await generator.list('udata', { coopname: 'voskhod', username: 'testuser2' })

    expect(udataList1.results).toHaveLength(2) // testuser1 имеет 2 разных ключа
    expect(udataList2.results).toHaveLength(1) // testuser2 имеет 1 ключ

    expect(udataList1.page).toBeDefined()
    expect(udataList1.limit).toBeDefined()
    expect(udataList1.totalPages).toBeDefined()
    expect(udataList1.totalResults).toBeDefined()

    expect(udataList2.page).toBeDefined()
    expect(udataList2.limit).toBeDefined()
    expect(udataList2.totalPages).toBeDefined()
    expect(udataList2.totalResults).toBeDefined()

    // Проверяем историю данных
    const history1 = await generator.getHistory('udata', {
      coopname: 'voskhod',
      username: 'testuser1',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
    }) as any[]

    expect(history1).toHaveLength(1)
    expect(history1[0].value).toEqual('test value 1')

    // Удаляем данные
    await generator.del('udata', {
      coopname: 'voskhod',
      username: 'testuser1',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
    })

    await generator.del('udata', {
      coopname: 'voskhod',
      username: 'testuser1',
      key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER,
    })

    await generator.del('udata', {
      coopname: 'voskhod',
      username: 'testuser2',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
    })

    // Проверяем, что данные помечены как удаленные
    const deleted1 = await generator.get('udata', {
      coopname: 'voskhod',
      username: 'testuser1',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
    }) as any

    const deleted2 = await generator.get('udata', {
      coopname: 'voskhod',
      username: 'testuser1',
      key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER,
    }) as any

    const deleted3 = await generator.get('udata', {
      coopname: 'voskhod',
      username: 'testuser2',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
    }) as any

    expect(deleted1).not.toBeNull()
    expect(deleted2).not.toBeNull()
    expect(deleted3).not.toBeNull()
    expect(deleted1.deleted).toEqual(true)
    expect(deleted2.deleted).toEqual(true)
    expect(deleted3.deleted).toEqual(true)
  })

  it('тестирование версионности данных по блокам', async () => {
    const storage = generator.storage as PostgresFactoryStorage
    if (!storage)
      throw new Error('Storage not connected')

    const baseUdata = {
      coopname: 'voskhod',
      username: 'versionuser',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
      deleted: false,
    }

    const saved1 = await storage.insert('udatas', {
      ...baseUdata,
      value: 'version 1',
      metadata: { version: 1 },
      block_num: 10,
    })
    expect(saved1.insertedId).toBeDefined()

    const saved2 = await storage.insert('udatas', {
      ...baseUdata,
      value: 'version 2',
      metadata: { version: 2 },
      block_num: 20,
    })
    expect(saved2.insertedId).toBeDefined()
    expect(saved1.insertedId).not.toEqual(saved2.insertedId)

    const saved3 = await storage.insert('udatas', {
      ...baseUdata,
      value: 'version 3',
      metadata: { version: 3 },
      block_num: 30,
    })
    expect(saved3.insertedId).toBeDefined()
    expect(saved3.insertedId).not.toEqual(saved2.insertedId)
    expect(saved3.insertedId).not.toEqual(saved1.insertedId)

    const saved4 = await storage.insert('udatas', {
      ...baseUdata,
      value: 'version 4',
      metadata: { version: 4 },
      block_num: 40,
    })
    expect(saved4.insertedId).toBeDefined()
    expect(saved4.insertedId).not.toEqual(saved3.insertedId)

    const savedIds = [saved1.insertedId, saved2.insertedId, saved3.insertedId, saved4.insertedId]
    expect(new Set(savedIds).size).toEqual(4)

    const current = await generator.get('udata', {
      coopname: 'voskhod',
      username: 'versionuser',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
    }) as any

    expect(current.value).toEqual('version 4')
    expect(current.metadata.version).toEqual(4)
    expect(current.block_num).toBeDefined()

    const history = await generator.getHistory('udata', {
      coopname: 'voskhod',
      username: 'versionuser',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
    }) as any[]

    expect(history.length).toEqual(4)

    expect(history[0].value).toEqual('version 4')
    expect(history[1].value).toEqual('version 3')
    expect(history[2].value).toEqual('version 2')
    expect(history[3].value).toEqual('version 1')

    expect(history[0].block_num).toBeGreaterThanOrEqual(history[1].block_num)
    expect(history[1].block_num).toBeGreaterThanOrEqual(history[2].block_num)
    expect(history[2].block_num).toBeGreaterThanOrEqual(history[3].block_num)

    const version2BlockNum = 20

    const filterWithBlock = {
      coopname: 'voskhod',
      username: 'versionuser',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
      block_num: version2BlockNum,
    }

    const versionAtBlock = await generator.get('udata', filterWithBlock) as any
    expect(versionAtBlock).toBeDefined()
    expect(versionAtBlock.value).toEqual('version 2')
    expect(versionAtBlock.metadata.version).toEqual(2)

    const blockBeforeVersion2 = version2BlockNum - 1
    const filterBeforeVersion2 = {
      coopname: 'voskhod',
      username: 'versionuser',
      key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
      block_num: blockBeforeVersion2,
    }

    const versionBeforeVersion2 = await generator.get('udata', filterBeforeVersion2) as any
    expect(versionBeforeVersion2).toBeDefined()
    expect(versionBeforeVersion2.value).toEqual('version 1')
    expect(versionBeforeVersion2.metadata.version).toEqual(1)
  })

  it('тестирование нескольких пользователей с одинаковыми ключами', async () => {
    const users = ['user1', 'user2', 'user3']

    // Сохраняем одинаковые ключи для разных пользователей
    for (const username of users) {
      const udata = {
        coopname: 'voskhod',
        username,
        key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
        value: `value for ${username}`,
        metadata: { user: username },
      }

      await generator.save('udata', udata)
    }

    // Проверяем, что каждый пользователь имеет свои данные
    for (const username of users) {
      const retrieved = await generator.get('udata', {
        coopname: 'voskhod',
        username,
        key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
      }) as any

      expect(retrieved.value).toEqual(`value for ${username}`)
      expect(retrieved.metadata.user).toEqual(username)
    }

    // Проверяем список всех данных
    const allUdata = await generator.list('udata', { coopname: 'voskhod' })
    expect(allUdata.results).toHaveLength(3)
    expect(allUdata.totalResults).toEqual(3)
  })
})
