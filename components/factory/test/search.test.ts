import { beforeAll, describe, expect, it } from 'vitest'
import { Generator } from '../src'
import type { ExternalEntrepreneurData, ExternalIndividualData, ExternalOrganizationData } from '../src/Models'
import { mongoUri } from './utils'
import { TestChainDataSource } from './utils/chain-data-source'

const generator = new Generator(new TestChainDataSource())

beforeAll(async () => {
  await generator.connect(mongoUri)
})

describe('тест поиска в фабрике документов', () => {
  it('подготовка тестовых данных', async () => {
    // Создаем тестовые данные для поиска
    const testIndividual: ExternalIndividualData = {
      username: 'search_test_individual',
      first_name: 'Иван',
      last_name: 'Иванов',
      middle_name: 'Иванович',
      birthdate: '01.01.1980',
      full_address: 'г. Москва, ул. Тестовая, д. 1',
      phone: '+7-900-123-45-67',
      email: 'ivan.ivanov@test.com',
      deleted: false,
    }

    const testEntrepreneur: ExternalEntrepreneurData = {
      username: 'search_test_entrepreneur',
      first_name: 'Петр',
      last_name: 'Петров',
      middle_name: 'Петрович',
      birthdate: '01.01.1985',
      full_address: 'г. Москва, ул. Предпринимательская, д. 2',
      phone: '+7-900-987-65-43',
      email: 'petr.petrov@test.com',
      country: 'Россия',
      city: 'Москва',
      details: {
        inn: '123456789012',
        ogrn: '1234567890123',
      },
      deleted: false,
    }

    const testOrganization: ExternalOrganizationData = {
      username: 'search_test_organization',
      type: 'coop',
      short_name: 'ООО "Тестовая Организация"',
      full_name: 'Общество с ограниченной ответственностью "Тестовая Организация"',
      represented_by: {
        first_name: 'Сидор',
        last_name: 'Сидоров',
        middle_name: 'Сидорович',
        position: 'Директор',
        based_on: 'Устав',
      },
      country: 'Россия',
      city: 'Москва',
      full_address: 'г. Москва, ул. Организационная, д. 3',
      fact_address: 'г. Москва, ул. Организационная, д. 3',
      phone: '+7-900-555-55-55',
      email: 'info@testorg.com',
      details: {
        inn: '9876543210',
        ogrn: '1234567890987',
        kpp: '123456789',
      },
      deleted: false,
    }

    // Сохраняем тестовые данные
    await generator.save('individual', testIndividual)
    await generator.save('entrepreneur', testEntrepreneur)
    await generator.save('organization', testOrganization)
  })

  it('поиск по имени физического лица', async () => {
    const results = await generator.search('Иван')

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    const individualResults = results.filter(r => r.type === 'individual')
    expect(individualResults.length).toBeGreaterThan(0)

    const foundIndividual = individualResults.find(r =>
      (r.data as ExternalIndividualData).username === 'search_test_individual',
    )
    expect(foundIndividual).toBeDefined()
    expect(foundIndividual?.highlightedFields).toContain('first_name')
  })

  it('поиск по фамилии', async () => {
    const results = await generator.search('Петров')

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    const entrepreneurResults = results.filter(r => r.type === 'entrepreneur')
    expect(entrepreneurResults.length).toBeGreaterThan(0)

    const foundEntrepreneur = entrepreneurResults.find(r =>
      (r.data as ExternalEntrepreneurData).username === 'search_test_entrepreneur',
    )
    expect(foundEntrepreneur).toBeDefined()
    expect(foundEntrepreneur?.highlightedFields).toContain('last_name')
  })

  it('поиск по ИНН предпринимателя', async () => {
    const results = await generator.search('123456789012')

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    const entrepreneurResults = results.filter(r => r.type === 'entrepreneur')
    expect(entrepreneurResults.length).toBeGreaterThan(0)

    const foundEntrepreneur = entrepreneurResults.find(r =>
      (r.data as ExternalEntrepreneurData).username === 'search_test_entrepreneur',
    )
    expect(foundEntrepreneur).toBeDefined()
    expect(foundEntrepreneur?.highlightedFields).toContain('details.inn')
  })

  it('поиск по названию организации', async () => {
    const results = await generator.search('Тестовая Организация')

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    const organizationResults = results.filter(r => r.type === 'organization')
    expect(organizationResults.length).toBeGreaterThan(0)

    const foundOrganization = organizationResults.find(r =>
      (r.data as ExternalOrganizationData).username === 'search_test_organization',
    )
    expect(foundOrganization).toBeDefined()
    expect(foundOrganization?.highlightedFields).toContain('short_name')
  })

  it('поиск по ИНН организации', async () => {
    const results = await generator.search('9876543210')

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    const organizationResults = results.filter(r => r.type === 'organization')
    expect(organizationResults.length).toBeGreaterThan(0)

    const foundOrganization = organizationResults.find(r =>
      (r.data as ExternalOrganizationData).username === 'search_test_organization',
    )
    expect(foundOrganization).toBeDefined()
    expect(foundOrganization?.highlightedFields).toContain('details.inn')
  })

  it('поиск по ОГРН', async () => {
    const results = await generator.search('1234567890123')

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    const entrepreneurResults = results.filter(r => r.type === 'entrepreneur')
    expect(entrepreneurResults.length).toBeGreaterThan(0)

    const foundEntrepreneur = entrepreneurResults.find(r =>
      (r.data as ExternalEntrepreneurData).username === 'search_test_entrepreneur',
    )
    expect(foundEntrepreneur).toBeDefined()
    expect(foundEntrepreneur?.highlightedFields).toContain('details.ogrn')
  })

  it('поиск по полному ФИО', async () => {
    // Теперь поиск по полному ФИО должен работать!
    const results = await generator.search('Иванов Иван Иванович')

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    const individualResults = results.filter(r => r.type === 'individual')
    expect(individualResults.length).toBeGreaterThan(0)

    const foundIndividual = individualResults.find(r =>
      (r.data as ExternalIndividualData).username === 'search_test_individual',
    )
    expect(foundIndividual).toBeDefined()
    expect(foundIndividual?.highlightedFields).toContain('full_name')
  })

  it('поиск по частичному ФИО (два слова)', async () => {
    const results = await generator.search('Петров Петр')

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)

    const entrepreneurResults = results.filter(r => r.type === 'entrepreneur')
    expect(entrepreneurResults.length).toBeGreaterThan(0)

    const foundEntrepreneur = entrepreneurResults.find(r =>
      (r.data as ExternalEntrepreneurData).username === 'search_test_entrepreneur',
    )
    expect(foundEntrepreneur).toBeDefined()
    expect(foundEntrepreneur?.highlightedFields).toContain('full_name')
  })

  it('поиск с пустым запросом', async () => {
    const results = await generator.search('')
    expect(results).toEqual([])

    const results2 = await generator.search('   ')
    expect(results2).toEqual([])
  })

  it('поиск несуществующих данных', async () => {
    const results = await generator.search('НесуществующийЗапрос12345')

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(0)
  })

  it('ограничение количества результатов', async () => {
    const results = await generator.search('test') // Поиск общего термина

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeLessThanOrEqual(10) // Не больше 10 результатов
  })

  it('очистка тестовых данных', async () => {
    // Удаляем тестовые данные
    await generator.del('individual', { username: 'search_test_individual' })
    await generator.del('entrepreneur', { username: 'search_test_entrepreneur' })
    await generator.del('organization', { username: 'search_test_organization' })
  })
})
