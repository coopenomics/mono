/**
 * Справочник категорий кооператива (test-registry/marketplace.categories.yaml):
 * защита базовых категорий, уникальность названия (в том числе при
 * одновременных запросах) и доступ к управлению только председателю.
 *
 * Собственные категории, заведённые тестом, удаляются в конце — справочник
 * виден каталогу и форме предложения следующих файлов прогона.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COUNCIL, ROLES, caseName, gql, gqlError, gqlRaw, tokenOf } from '../core'

const TAG = Date.now().toString(36)

const LIST = 'query{ marketplaceListCoopCategories{ id display_name mvp_baseline } }'
const CREATE = 'mutation($i:CreateCustomCategoryInput!){ marketplaceCreateCustomCategory(input:$i){ id display_name mvp_baseline } }'
const DELETE = 'mutation($id:Int!){ marketplaceDeleteCustomCategory(categoryId:$id) }'
const REMOVE_AVAILABLE = 'mutation($i:RemoveAvailableCategoriesInput!){ marketplaceRemoveAvailableCategories(input:$i) }'
const STATS = 'query{ marketplaceGetAvailabilityStats{ totalAvailable categoriesCount typesCount hasRestrictions } }'

const code = (e: { code: unknown } | null) => String(e?.code ?? '')
const norm = (s: string) => s.trim().toLowerCase()

let chair: string
const created: number[] = []

async function categories(): Promise<{ id: number, display_name: string, mvp_baseline: boolean }[]> {
  return (await gql<any>(chair, LIST)).marketplaceListCoopCategories
}

async function withName(displayName: string) {
  return (await categories()).filter(c => norm(c.display_name) === norm(displayName))
}

async function createCategory(displayName: string): Promise<{ id: number, display_name: string }> {
  const c = (await gql<any>(chair, CREATE, { i: { displayName } })).marketplaceCreateCustomCategory
  created.push(c.id)
  return c
}

beforeAll(async () => {
  chair = await tokenOf(CHAIRMAN)
})

afterAll(async () => {
  for (const id of created)
    await gql(chair, DELETE, { id }).catch(() => {})
})

describe('категории кооператива', () => {
  it(caseName('mkt.cat.side.01', 'базовую категорию удалить нельзя'), async () => {
    const base = (await categories()).find(c => c.mvp_baseline)
    expect(base, 'в справочнике есть базовая категория').toBeTruthy()
    const err = await gqlError(chair, DELETE, { id: base!.id })
    expect(code(err)).toBe('MARKETPLACE_CATEGORY_BASE_DELETE_FORBIDDEN')
    expect((await categories()).some(c => c.id === base!.id)).toBe(true)
  })

  // Резолвер создания перехватывает отказ сервиса и отдаёт его как 400 без
  // доменного кода — отказ различим только по тексту.
  it(caseName('mkt.cat.side.02', 'имя, уже занятое базовой или собственной категорией, — отказ, дубликат не создаётся'), async () => {
    const base = (await categories()).find(c => c.mvp_baseline)!
    const likeBase = `  ${base.display_name.toUpperCase()} `
    const e1 = await gqlError(chair, CREATE, { i: { displayName: likeBase } })
    expect(code(e1)).toBe('400')
    expect(e1!.message).toMatch(/уже существует/i)
    expect(await withName(base.display_name)).toHaveLength(1)

    const own = await createCategory(`АТ категория ${TAG}`)
    const e2 = await gqlError(chair, CREATE, { i: { displayName: ` ат КАТЕГОРИЯ ${TAG.toUpperCase()}  ` } })
    expect(code(e2)).toBe('400')
    expect(e2!.message).toBe(e1!.message)
    const same = await withName(own.display_name)
    expect(same.map(c => c.id)).toEqual([own.id])
  })

  it(caseName('mkt.cat.side.08', 'два одновременных запроса с одним именем — одна категория, второй получает тот же отказ'), async () => {
    const reference = await gqlError(chair, CREATE, { i: { displayName: (await categories()).find(c => c.mvp_baseline)!.display_name } })
    for (let round = 1; round <= 3; round++) {
      const displayName = `АТ гонка ${round} ${TAG}`
      const results = await Promise.all([
        gqlRaw<any>(chair, CREATE, { i: { displayName } }),
        gqlRaw<any>(chair, CREATE, { i: { displayName } }),
      ])
      const ok = results.filter(r => r.errors.length === 0)
      const failed = results.filter(r => r.errors.length > 0)
      for (const r of ok) created.push(r.data.marketplaceCreateCustomCategory.id)
      expect(ok, `раунд ${round}: создан ровно один запрос`).toHaveLength(1)
      expect(failed).toHaveLength(1)
      expect(code(failed[0].errors[0])).toBe(code(reference))
      expect(failed[0].errors[0].message).toBe(reference!.message)
      const rows = await withName(displayName)
      expect(rows.map(c => c.id), `раунд ${round}: в справочнике одна категория`).toEqual([ok[0].data.marketplaceCreateCustomCategory.id])
    }
  })

  it(caseName('mkt.cat.side.03', 'управление категориями без роли председателя — отказ, справочник не меняется'), async () => {
    const own = await createCategory(`АТ чужие руки ${TAG}`)
    const before = (await categories()).map(c => c.id).sort()
    const statsBefore = (await gql<any>(chair, STATS)).marketplaceGetAvailabilityStats

    for (const who of [ROLES.member(), ROLES.supplier(), ROLES.branchChairman(), COUNCIL]) {
      const t = await tokenOf(who)
      const label = who.account
      expect(code(await gqlError(t, CREATE, { i: { displayName: `АТ от ${label} ${TAG}` } })), `${label}: создание`).toBe('KIT_INSUFFICIENT_RIGHTS')
      expect(code(await gqlError(t, DELETE, { id: own.id })), `${label}: удаление`).toBe('KIT_INSUFFICIENT_RIGHTS')
      expect(code(await gqlError(t, REMOVE_AVAILABLE, { i: { categoryIds: [own.id] } })), `${label}: ограничение каталога`).toBe('KIT_INSUFFICIENT_RIGHTS')
      expect(code(await gqlError(t, LIST)), `${label}: редактируемый список`).toBe('KIT_INSUFFICIENT_RIGHTS')
    }

    expect((await categories()).map(c => c.id).sort()).toEqual(before)
    expect((await gql<any>(chair, STATS)).marketplaceGetAvailabilityStats).toEqual(statsBefore)
  })
})
