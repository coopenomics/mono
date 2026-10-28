import { chainFixtures, findFixtures } from '../store'

export const draftTableMock = {
  code: 'draft',
  table: 'drafts',
  data: null,
  match(url: string, params?: URLSearchParams): boolean {
    if (!url.includes('/get-tables') || !params) return false
    const filter = params.get('filter')
    if (!filter) return false
    try {
      const obj = JSON.parse(filter)
      return obj.code === 'draft' && obj.table === 'drafts'
    }
    catch { return false }
  },
  async resolve(url: string, params?: URLSearchParams): Promise<any> {
    const filter = params ? JSON.parse(params.get('filter') || '{}') : {}
    const query: any = { code: 'draft', table: 'drafts' }
    if (filter['value.registry_id']) query['value.registry_id'] = filter['value.registry_id']
    const results = findFixtures(chainFixtures.deltas, query)
    return { results }
  },
}

export const draftTranslationsMock = {
  code: 'draft',
  table: 'translations',
  data: null,
  match(url: string, params?: URLSearchParams): boolean {
    if (!url.includes('/get-tables') || !params) return false
    const filter = params.get('filter')
    if (!filter) return false
    try {
      const obj = JSON.parse(filter)
      return obj.code === 'draft' && obj.table === 'translations'
    }
    catch { return false }
  },
  async resolve(url: string, params?: URLSearchParams): Promise<any> {
    const filter = params ? JSON.parse(params.get('filter') || '{}') : {}
    let draftId = filter['value.draft_id']

    if (draftId) {
      const [draft] = findFixtures(chainFixtures.deltas, {
        'code': 'draft',
        'table': 'drafts',
        'value.registry_id': draftId,
      })
      if (draft?.value?.id) {
        draftId = String(draft.value.id)
      }
    }

    const query: any = { code: 'draft', table: 'translations' }
    if (draftId) query['value.draft_id'] = draftId
    const results = findFixtures(chainFixtures.deltas, query)
    return { results }
  },
}
