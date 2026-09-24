// Временная диагностика первого прогона (ext-misc): наполнен ли справочник
// категорий Ozon на стенде. Файл удаляется до сдачи.
import { describe, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, gqlRaw, tokenOf } from '../core'

describe('probe', () => {
  it('справочник категорий и заявок', async () => {
    const member = await tokenOf(ROLES.member())
    const chairman = await tokenOf(CHAIRMAN)
    const tree = await gqlRaw(member, `query{ marketplaceGetCategoryTree(input:{ includeTypes:false, maxDepth:1 }){ descriptionCategoryId categoryName childrenCount } }`)
    console.log('PROBE-TREE', JSON.stringify(tree.errors), JSON.stringify(tree.data)?.slice(0, 500))
    const stats = await gqlRaw(member, `query{ marketplaceAttributeStats{ totalAttributes totalDictionaries totalDictionaryValues requiredAttributes } }`)
    console.log('PROBE-ATTR', JSON.stringify(stats.errors), JSON.stringify(stats.data))
    const reqs = await gqlRaw(chairman, `query($d:GetCoopRequestsInput!){ marketplaceGetCoopRequests(data:$d){ __typename } }`, { d: { coopname: COOP, limit: 5 } })
    console.log('PROBE-REQ', JSON.stringify(reqs.errors), JSON.stringify(reqs.data))
    const avail = await gqlRaw(chairman, `query{ marketplaceGetAvailableCategories{ __typename } }`)
    console.log('PROBE-AVAIL', JSON.stringify(avail.errors), JSON.stringify(avail.data)?.slice(0, 300))
  })
})
