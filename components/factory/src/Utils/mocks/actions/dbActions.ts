import { chainFixtures, findFixtures } from '../store'

export const dbActionsMock = {
  match(url: string, params?: URLSearchParams): boolean {
    if (!url.includes('/get-actions') || !params) return false
    const filter = params.get('filter')
    if (!filter) return false
    try {
      JSON.parse(filter)
      return true
    }
    catch { return false }
  },
  async resolve(url: string, params?: URLSearchParams): Promise<any> {
    const filter = params ? JSON.parse(params.get('filter') || '{}') : {}
    const query: any = {}
    if (filter.account) query.account = filter.account
    if (filter.name) query.name = filter.name
    if (filter.receiver) query.receiver = filter.receiver
    for (const key of Object.keys(filter)) {
      if (key.startsWith('data.')) query[key] = filter[key]
    }
    const results = findFixtures(chainFixtures.actions, query)
    return { results }
  },
}
