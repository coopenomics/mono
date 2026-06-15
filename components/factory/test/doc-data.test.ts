import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoDBConnector } from '../src/Services/Databazor'
import { DocDataService } from '../src/Services/DocData'
import { generator, mongoUri } from './utils'

describe('DocDataService — приватные данные документов', () => {
  let storage: MongoDBConnector
  let service: DocDataService

  beforeAll(async () => {
    storage = new MongoDBConnector(mongoUri)
    await storage.connect()
    service = new DocDataService(storage)
    await storage.getCollection('doc_private_data').deleteMany({})
  })

  afterAll(async () => {
    await storage.disconnect()
  })

  it('save → возвращает sha256 hash и сохраняет payload', async () => {
    const payload = {
      expeditor_full_name: 'Иванов Иван Иванович',
      passport: '4509 123456',
      phone: '+79991234567',
      vehicle_registration_number: 'А123ВВ77',
    }

    const { hash } = await service.save(payload, 1103)
    expect(hash).toMatch(/^[A-F0-9]{64}$/)

    const restored = await service.get(hash)
    expect(restored).toEqual(payload)
  })

  it('save идемпотентен: одинаковый payload → одинаковый hash, без дублей', async () => {
    const payload = { foo: 'bar', baz: 42 }

    const r1 = await service.save(payload, 1102)
    const r2 = await service.save(payload, 1102)
    expect(r1.hash).toEqual(r2.hash)

    const count = await storage.getCollection('doc_private_data').countDocuments({ hash: r1.hash })
    expect(count).toBe(1)
  })

  it('save стабилен по порядку ключей: {a,b} и {b,a} → один и тот же hash', async () => {
    const r1 = await service.save({ a: 1, b: 2 }, 1102)
    const r2 = await service.save({ b: 2, a: 1 }, 1102)
    expect(r1.hash).toEqual(r2.hash)
  })

  it('get → null если запись удалена (graceful degradation)', async () => {
    const { hash } = await service.save({ tmp: 'будет удалён' }, 1102)
    await storage.getCollection('doc_private_data').deleteOne({ hash })

    const restored = await service.get(hash)
    expect(restored).toBeNull()
  })

  it('Generator-фасад: saveDocData / getDocData делегируются', async () => {
    await generator.connect(mongoUri)
    try {
      const payload = { signer_full_name: 'Петров Пётр Петрович' }
      const { hash } = await generator.saveDocData(payload, 1102)
      const restored = await generator.getDocData(hash)
      expect(restored).toEqual(payload)
    }
    finally {
      await generator.disconnect()
    }
  })
})
