/**
 * Единый поиск окна столов и страниц снаружи (platform.global-search).
 *
 * Окно шлёт один запрос `globalSearch`, ядро опрашивает поставщиков и отдаёт
 * находки группами. Здесь проверяется то, что видит клиент: совет находит
 * пайщика по фамилии и получает ссылку на его страницу, рядовой пайщик чужих
 * личных данных не находит, документы ведут в стол того, кто ищет, а короткий
 * запрос и гость ответа не получают.
 *
 * Пайщик для поиска — фикстура `ekaterina` (Смирнова Екатерина
 * Александровна), её заводит засев стенда.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, COUNCIL, ROLES, caseName, gql, gqlError, tokenOf } from '../core'

interface Hit {
  key: string
  title: string
  subtitle: string | null
  route: { name: string, params: Record<string, string> | null }
}
interface Group { key: string, status: string, hits: Hit[] }

const SEARCH = `query($d: GlobalSearchInput!){
  globalSearch(data: $d){ key status hits { key title subtitle route { name params } } }
}`

async function search(token: string | null, query: string, limit = 5): Promise<Group[]> {
  const { globalSearch } = await gql<{ globalSearch: Group[] }>(token, SEARCH, { d: { query, limit } })
  return globalSearch
}

const group = (groups: Group[], key: string) => groups.find(g => g.key === key)

describe('единый поиск', () => {
  it(caseName('plat.gsearch.happy.01', 'совет находит пайщика по фамилии, находка ведёт на страницу пайщика'), async () => {
    const who = ROLES.member()
    for (const reader of [CHAIRMAN, COUNCIL]) {
      const groups = await search(await tokenOf(reader), 'Смирнова')
      const participants = group(groups, 'participants')
      expect(participants?.status).toBe('OK')
      const hit = participants?.hits.find(h => h.key === who.account)
      expect(hit?.title).toContain('Смирнова')
      expect(hit?.route.name).toBe('participant-details')
      expect(hit?.route.params?.username).toBe(who.account)
    }
  })

  it(caseName('plat.gsearch.side.01', 'рядовой пайщик личных данных других пайщиков не находит'), async () => {
    const groups = await search(await tokenOf(ROLES.otherMember()), 'Смирнова')
    expect(group(groups, 'participants')).toBeUndefined()
  })

  it(caseName('plat.gsearch.happy.02', 'совет находит документы кооператива и открывает их в своём столе'), async () => {
    const groups = await search(await tokenOf(CHAIRMAN), 'Заявление')
    const documents = group(groups, 'documents')
    expect(documents?.hits.length).toBeGreaterThan(0)
    for (const hit of documents!.hits)
      expect(hit.route.name).toBe('document-details')
  })

  it(caseName('plat.gsearch.side.02', 'пайщик не находит чужих документов, свои открывает в столе пайщика'), async () => {
    // Документы другого пайщика ищутся по его аккаунту: совет их находит,
    // рядовой пайщик — нет.
    const other = ROLES.otherMember().account
    const council = group(await search(await tokenOf(CHAIRMAN), other), 'documents')
    expect(council?.hits.length).toBeGreaterThan(0)

    const token = await tokenOf(ROLES.member())
    expect(group(await search(token, other), 'documents')).toBeUndefined()

    const own = group(await search(token, 'Заявление'), 'documents')
    expect(own?.hits.length).toBeGreaterThan(0)
    for (const hit of own!.hits)
      expect(hit.route.name).toBe('user-document-details')
  })

  it(caseName('plat.gsearch.side.05', 'группы идут по порядку источников, находок не больше предела'), async () => {
    // По фамилии находится и сама пайщица, и подписанные ею документы.
    const groups = await search(await tokenOf(CHAIRMAN), 'Смирнова', 1)
    const keys = groups.map(g => g.key)
    expect(keys).toContain('participants')
    expect(keys).toContain('documents')
    expect(keys.indexOf('participants')).toBeLessThan(keys.indexOf('documents'))
    for (const g of groups)
      expect(g.hits.length).toBeLessThanOrEqual(1)
  })

  it(caseName('plat.gsearch.side.03', 'запрос короче двух символов ничего не ищет'), async () => {
    expect(await search(await tokenOf(CHAIRMAN), ' С ')).toEqual([])
  })

  it(caseName('plat.gsearch.side.04', 'гостю поиск закрыт'), async () => {
    const error = await gqlError(null, SEARCH, { d: { query: 'Смирнова' } })
    expect(error).not.toBeNull()
  })
})
