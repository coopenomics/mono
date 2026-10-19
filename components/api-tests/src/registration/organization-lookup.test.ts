/**
 * Анкета организации и ИП по ИНН (registration.organization-lookup).
 *
 * Коннектор России — расширение DaData. На стенде настоящего DaData нет: в
 * скрытой настройке расширения `api_url` стоит адрес подставного узла, и узел
 * играет сервис — тест задаёт карточку и читает, что платформа у него спросила.
 * Ответы сверены с модульными тестами перевода карточки; данные вымышленные.
 *
 * Поиск открыт без входа и ограничен по частоте, поэтому каждый запрос идёт со
 * своего адреса. В конце расширение выключается, настройки стираются.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, STUB_URL, caseName, gql, stubRequests, stubReset, stubRoute, tokenOf, waitFor } from '../core'
import { gqlOkFrom, uniqueIp } from '../coopid/coopid-b.helpers'

const UPDATE = `mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }`
const COUNTRIES = `query{ getOrganizationLookupCountries }`
const LOOKUP_ORG = `query($d:LookupOrganizationInput!){ lookupOrganization(data:$d){
  short_name full_name type city full_address
  represented_by{ last_name first_name middle_name position }
  details{ inn ogrn kpp } } }`
const LOOKUP_IP = `query($d:LookupOrganizationInput!){ lookupEntrepreneur(data:$d){
  last_name first_name middle_name city details{ inn ogrn } } }`

const RUSSIA = 'Russia'
const PARTY_PATH = '/dadata/findById/party'
const STUB_KEY = 'stub-dadata-key'

const PARTY = {
  inn: '7700000000',
  ogrn: '1247700000000',
  kpp: '770001001',
  name: { full_with_opf: 'ПОТРЕБИТЕЛЬСКИЙ КООПЕРАТИВ "РОМАШКА"', short_with_opf: 'ПК "РОМАШКА"' },
  opf: { code: '20100' },
  management: { name: 'Иванов Иван Иванович', post: 'ПРЕДСЕДАТЕЛЬ СОВЕТА' },
  address: {
    value: 'г Москва, ул Луговая, д 1',
    unrestricted_value: '117000, г Москва, ул Луговая, д 1',
    data: { city: 'Москва', settlement: null, region: 'Москва' },
  },
}

const IP = {
  inn: '770000000001',
  ogrn: '324770000000001',
  fio: { surname: 'Петров', name: 'Сергей', patronymic: 'Николаевич' },
  address: { value: 'г Москва', unrestricted_value: '101000, г Москва', data: { city: 'Москва', region: 'Москва' } },
}

const card = (data: unknown) => ({ status: 200, body: { suggestions: [{ data }] } })

async function configure(enabled: boolean, apiUrl: string) {
  await gql(await tokenOf(CHAIRMAN), UPDATE, {
    d: { name: 'dadata', enabled, config: { api_key: enabled ? STUB_KEY : '', secret_key: '', api_url: apiUrl } },
  })
}

async function countries(): Promise<string[]> {
  return (await gqlOkFrom<any>(uniqueIp(), null, COUNTRIES)).getOrganizationLookupCountries
}

/** Расширение перезапускается после сохранения настроек не сразу — ждём, пока коннектор встанет или снимется. */
async function awaitConnector(present: boolean) {
  await waitFor(async () => ((await countries()).includes(RUSSIA) === present ? true : null),
    { timeoutMs: 60_000, intervalMs: 1_000, label: present ? 'коннектор России в реестре' : 'коннектор России снят' })
}

const lookupOrg = async (inn: string, country = RUSSIA) =>
  (await gqlOkFrom<any>(uniqueIp(), null, LOOKUP_ORG, { d: { country, inn } })).lookupOrganization
const lookupIp = async (inn: string) =>
  (await gqlOkFrom<any>(uniqueIp(), null, LOOKUP_IP, { d: { country: RUSSIA, inn } })).lookupEntrepreneur

describe('анкета организации и ИП по ИНН через DaData', () => {
  beforeAll(async () => {
    await stubReset()
    await configure(true, `${STUB_URL}/dadata`)
    await awaitConnector(true)
  }, 120_000)

  afterAll(async () => {
    await configure(false, '')
  })

  it(caseName('reg.orglookup.happy.01', 'коннектор России стоит: поиск по ИНН идёт в сервис с ключом кооператива, головной организацией'), async () => {
    await stubRoute('POST', PARTY_PATH, card(PARTY))
    expect(await countries()).toContain(RUSSIA)
    expect(await lookupOrg('7700000000')).not.toBeNull()

    const [request] = (await stubRequests(PARTY_PATH)).slice(-1)
    expect(request.headers.authorization).toBe(`Token ${STUB_KEY}`)
    expect(request.body).toMatchObject({ query: '7700000000', type: 'LEGAL', branch_type: 'MAIN' })
  })

  it(caseName('reg.orglookup.happy.02', 'карточка потребительского кооператива раскладывается по полям анкеты'), async () => {
    await stubRoute('POST', PARTY_PATH, card(PARTY))
    expect(await lookupOrg('7700000000')).toEqual({
      short_name: 'ПК "РОМАШКА"',
      full_name: 'ПОТРЕБИТЕЛЬСКИЙ КООПЕРАТИВ "РОМАШКА"',
      type: 'COOP',
      city: 'Москва',
      full_address: '117000, г Москва, ул Луговая, д 1',
      represented_by: { last_name: 'Иванов', first_name: 'Иван', middle_name: 'Иванович', position: 'Председатель совета' },
      details: { inn: '7700000000', ogrn: '1247700000000', kpp: '770001001' },
    })
  })

  it(caseName('reg.orglookup.side.01', 'без руководителя и адреса эти поля остаются пайщику'), async () => {
    await stubRoute('POST', PARTY_PATH, card({ inn: '7700000000', management: null, address: null }))
    const found = await lookupOrg('7700000000')
    expect(found.represented_by).toBeNull()
    expect(found.city).toBeNull()
    expect(found.full_address).toBeNull()
  })

  it(caseName('reg.orglookup.side.02', 'правовая форма вне трёх типов анкеты — тип выбирает пайщик'), async () => {
    await stubRoute('POST', PARTY_PATH, card({ ...PARTY, opf: { code: '12267' } }))
    expect((await lookupOrg('7700000000')).type).toBeNull()
  })

  it(caseName('reg.orglookup.side.03', 'для страны анкеты коннектора нет — сведений нет, анкета вручную'), async () => {
    expect(await countries()).not.toContain('Belarus')
    expect(await lookupOrg('7700000000', 'Belarus')).toBeNull()
  })

  it(caseName('reg.orglookup.break.01', 'сервис отвечает ошибкой (неверный ключ, лимит) — сведений нет, анкета вручную'), async () => {
    await stubRoute('POST', PARTY_PATH, { status: 403, body: { message: 'Forbidden' } })
    expect(await lookupOrg('7700000000')).toBeNull()
  })

  it(caseName('reg.orglookup.happy.04', 'карточка ИП: ФИО по частям, ИНН, ОГРНИП, город; поиск идёт по ИП'), async () => {
    await stubRoute('POST', PARTY_PATH, card(IP))
    expect(await lookupIp('770000000001')).toEqual({
      last_name: 'Петров',
      first_name: 'Сергей',
      middle_name: 'Николаевич',
      city: 'Москва',
      details: { inn: '770000000001', ogrn: '324770000000001' },
    })
    const [request] = (await stubRequests(PARTY_PATH)).slice(-1)
    expect(request.body).toMatchObject({ query: '770000000001', type: 'INDIVIDUAL' })
  })

  it(caseName('reg.orglookup.side.08', 'у ИП нет отчества, адрес назван только регионом — поля остаются пайщику'), async () => {
    await stubRoute('POST', PARTY_PATH, card({
      ...IP,
      fio: { surname: 'Петров', name: 'Сергей', patronymic: null },
      address: { value: 'Московская обл', data: { city: null, settlement: null, region: 'Московская' } },
    }))
    const found = await lookupIp('770000000001')
    expect(found.middle_name).toBeNull()
    expect(found.city).toBeNull()
  })

  it(caseName('reg.orglookup.break.02', 'сервис не отвечает дольше предела ожидания — сведений нет, анкета вручную'), async () => {
    // Предел ожидания реестра — 5 секунд; узел отвечает позже.
    await stubRoute('POST', PARTY_PATH, { ...card(PARTY), delayMs: 7_000 })
    expect(await lookupOrg('7700000000')).toBeNull()
  }, 60_000)

  it(caseName('reg.orglookup.side.04', 'расширение выключено — коннектор снят, анкета вручную'), async () => {
    await configure(false, '')
    await awaitConnector(false)
    expect(await lookupOrg('7700000000')).toBeNull()
  }, 120_000)
})
