import { chainFixtures, findFixtures } from '../store'

export const cooperativeTableMock = {
  match(url: string, params?: URLSearchParams): boolean {
    if (!url.includes('/get-tables') || !params) return false
    const filter = params.get('filter')
    if (!filter) return false
    try {
      const obj = JSON.parse(filter)
      return (obj.code === 'registrator' && obj.table === 'coops')
        || (obj.code === 'soviet' && obj.table === 'boards')
        || (obj.code === 'soviet' && obj.table === 'decisions')
        || (obj.code === 'soviet' && obj.table === 'participants')
    }
    catch { return false }
  },
  async resolve(url: string, params?: URLSearchParams): Promise<any> {
    const filter = params ? JSON.parse(params.get('filter') || '{}') : {}
    const query: any = {}
    if (filter.code) query.code = filter.code
    if (filter.scope) query.scope = filter.scope
    if (filter.table) query.table = filter.table
    for (const key of Object.keys(filter)) {
      if (key.startsWith('value.')) query[key] = filter[key]
    }
    const results = findFixtures(chainFixtures.deltas, query)
    return { results }
  },
}
