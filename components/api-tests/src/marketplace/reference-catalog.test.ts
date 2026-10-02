/**
 * Стол заказов: внешний справочник категорий и характеристик, заявки по нему,
 * витрина кооператива (test-registry/marketplace.reference-catalog.yaml).
 *
 * Справочник (дерево категорий, типы товаров, характеристики, словари
 * значений) заполняется вне платформы: загрузчика у узла нет, на свежем
 * кооперативе он пуст. Чтение пустого справочника отвечает пустыми списками,
 * а заявка по нему отклоняется — категории нет. Витрина по умолчанию
 * заводится при установке Стола заказов.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, COUNCIL, ROLES, caseName, expectAuthDenied, expectCode, gql, gqlError, tokenOf } from '../core'

const NODE = 'descriptionCategoryId categoryName childrenCount'
const TREE = `query($i:GetCategoryTreeInput){ marketplaceGetCategoryTree(input:$i){ ${NODE} } }`
const ROOTS = `query{ marketplaceGetRootCategories{ ${NODE} } }`
const CATEGORY = `query($d:GetCategoryByIdInput!){ marketplaceGetCategoryById(data:$d){ ${NODE} } }`
const TYPE = 'query($d:GetProductTypeByIdInput!){ marketplaceGetProductTypeById(data:$d){ __typename } }'
const SEARCH_CATEGORIES = `query($d:SearchCategoriesInput!){ marketplaceGetSearchCategories(data:$d){ ${NODE} } }`
const TREE_STATS = 'query{ marketplaceGetCategoryTreeStats{ __typename } }'
const AVAILABLE_TREE = `query{ marketplaceGetAvailableCategoryTree{ ${NODE} } }`
const ATTRIBUTES = 'query($i:GetCategoryAttributesInput!){ marketplaceCategoryAttributes(input:$i){ __typename } }'
const ATTRIBUTES_GROUPED = 'query($i:GetCategoryAttributesInput!){ marketplaceCategoryAttributesGrouped(input:$i){ __typename } }'
const REQUIRED = 'query($d:GetRequiredAttributesInput!){ marketplaceRequiredAttributes(data:$d){ __typename } }'
const ASPECT = 'query($d:GetRequiredAttributesInput!){ marketplaceAspectAttributes(data:$d){ __typename } }'
const SEARCH_ATTRIBUTES = 'query($i:SearchAttributesInput!){ marketplaceSearchAttributes(input:$i){ __typename } }'
const SEARCH_VALUES = 'query($i:SearchDictionaryValuesInput!){ marketplaceSearchDictionaryValues(input:$i){ __typename } }'
const ATTRIBUTE_STATS = 'query{ marketplaceAttributeStats{ __typename } }'
const CREATE_REQUEST = 'mutation($d:CreateRequestInput!){ marketplaceCreateRequest(data:$d){ __typename } }'
const REQUEST = 'query($d:GetRequestInput!){ marketplaceGetRequest(data:$d){ __typename } }'
const REQUEST_BY_HASH = 'query($d:GetRequestByHashInput!){ marketplaceGetRequestByHash(data:$d){ __typename } }'
const MY_REQUESTS = 'query($d:GetUserRequestsInput){ marketplaceGetUserRequests(data:$d){ __typename } }'
const COOP_REQUESTS = 'query($d:GetCoopRequestsInput!){ marketplaceGetCoopRequests(data:$d){ __typename } }'
const SEARCH_REQUESTS = 'query($d:SearchRequestsInput!){ marketplaceSearchRequests(data:$d){ __typename } }'
const REQUEST_STATS = 'query($d:GetRequestStatisticsInput!){ marketplaceGetRequestStatistics(data:$d){ __typename } }'
const VITRINE = 'query{ marketplaceDefaultVitrine{ id coopname display_name is_default } }'

const NO_SUCH = 987_654_321

let chairman = ''
let council = ''
let member = ''

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  council = await tokenOf(COUNCIL)
  member = await tokenOf(ROLES.member())
})

describe('Стол заказов — внешний справочник категорий', () => {
  it(caseName('mkt.ref.happy.01', 'справочник свежего кооператива пуст: дерево, корни и поиск отвечают пустыми списками, категория по номеру — пусто'), async () => {
    expect((await gql<any>(member, TREE, { i: { includeTypes: true } })).marketplaceGetCategoryTree).toEqual([])
    expect((await gql<any>(member, TREE, { i: { onlyAvailable: true, maxDepth: 2 } })).marketplaceGetCategoryTree).toEqual([])
    expect((await gql<any>(member, ROOTS)).marketplaceGetRootCategories).toEqual([])
    expect((await gql<any>(member, SEARCH_CATEGORIES, { d: { searchTerm: 'молоко' } })).marketplaceGetSearchCategories).toEqual([])
    expect((await gql<any>(member, CATEGORY, { d: { categoryId: NO_SUCH } })).marketplaceGetCategoryById).toBeNull()
    expect((await gql<any>(member, TYPE, { d: { typeId: NO_SUCH } })).marketplaceGetProductTypeById).toBeNull()
    expect((await gql<any>(member, TREE_STATS)).marketplaceGetCategoryTreeStats).toBeTruthy()
    expect((await gql<any>(chairman, AVAILABLE_TREE)).marketplaceGetAvailableCategoryTree).toEqual([])
  })

  it(caseName('mkt.ref.happy.02', 'характеристики и словари пустого справочника читаются без ошибок — пустыми списками'), async () => {
    const pair = { categoryId: NO_SUCH, typeId: NO_SUCH }
    expect((await gql<any>(member, ATTRIBUTES, { i: pair })).marketplaceCategoryAttributes).toEqual([])
    expect((await gql<any>(member, ATTRIBUTES_GROUPED, { i: { ...pair, onlyRequired: true } })).marketplaceCategoryAttributesGrouped).toEqual([])
    expect((await gql<any>(member, REQUIRED, { d: pair })).marketplaceRequiredAttributes).toEqual([])
    expect((await gql<any>(member, ASPECT, { d: pair })).marketplaceAspectAttributes).toEqual([])
    expect((await gql<any>(member, SEARCH_ATTRIBUTES, { i: { searchTerm: 'цвет' } })).marketplaceSearchAttributes).toEqual([])
    expect((await gql<any>(member, SEARCH_ATTRIBUTES, { i: { searchTerm: 'цвет', ...pair, onlyWithDictionary: true } })).marketplaceSearchAttributes).toEqual([])
    expect((await gql<any>(member, SEARCH_VALUES, { i: { dictionaryId: NO_SUCH, searchTerm: 'красный' } })).marketplaceSearchDictionaryValues).toEqual([])
    expect((await gql<any>(member, ATTRIBUTE_STATS)).marketplaceAttributeStats).toBeTruthy()
  })

  it(caseName('mkt.ref.side.01', 'справочник читает только пайщик — гостю отказ входа'), async () => {
    expectAuthDenied(await gqlError(null, ROOTS))
    expectAuthDenied(await gqlError(null, SEARCH_ATTRIBUTES, { i: { searchTerm: 'цвет' } }))
  })
})

describe('Стол заказов — заявки по справочнику', () => {
  const request = {
    coopname: COOP,
    type: 'OFFER',
    name: 'Заявка внешнего теста',
    articleNumber: `ART-${Date.now().toString(36)}`,
    descriptionCategoryId: NO_SUCH,
    typeId: NO_SUCH,
    price: 100,
    units: 1,
    vat: '0',
    primaryImageUrl: 'https://example.com/a.png',
  }

  it(caseName('mkt.ref.side.02', 'заявка по категории, которой нет в справочнике, отклоняется и не заводится'), async () => {
    expectCode(await gqlError(council, CREATE_REQUEST, { d: request }), 'MARKETPLACE_REQUEST_CATEGORY_NOT_FOUND')
    expect((await gql<any>(council, MY_REQUESTS, { d: { limit: 20 } })).marketplaceGetUserRequests).toEqual([])
    expect((await gql<any>(council, SEARCH_REQUESTS, { d: { searchTerm: 'внешнего теста' } })).marketplaceSearchRequests).toEqual([])
  })

  it(caseName('mkt.ref.happy.03', 'заявок нет: списки пусты, заявка по номеру и по хешу — пусто, сводка считается'), async () => {
    expect((await gql<any>(chairman, COOP_REQUESTS, { d: { coopname: COOP } })).marketplaceGetCoopRequests).toEqual([])
    expect((await gql<any>(member, REQUEST, { d: { id: NO_SUCH } })).marketplaceGetRequest).toBeNull()
    expect((await gql<any>(member, REQUEST_BY_HASH, { d: { hash: 'f'.repeat(64) } })).marketplaceGetRequestByHash).toBeNull()
    expect((await gql<any>(chairman, REQUEST_STATS, { d: { coopname: COOP } })).marketplaceGetRequestStatistics).toBeTruthy()
  })

  it(caseName('mkt.ref.side.03', 'заявку подаёт только совет — пайщику отказ; гостю отказ входа'), async () => {
    const err = await gqlError(member, CREATE_REQUEST, { d: request })
    expect(err, 'пайщику отказ по правам').not.toBeNull()
    expect(['KIT_INSUFFICIENT_RIGHTS', '403']).toContain(String(err!.code))
    expectAuthDenied(await gqlError(null, CREATE_REQUEST, { d: request }))
  })
})

describe('Стол заказов — витрина кооператива', () => {
  it(caseName('mkt.ref.happy.04', 'витрина по умолчанию заведена при установке Стола заказов и видна пайщику'), async () => {
    const vitrine = (await gql<any>(member, VITRINE)).marketplaceDefaultVitrine
    expect(vitrine).toMatchObject({ coopname: COOP, is_default: true })
    expect(vitrine.display_name).toBeTruthy()
    expect((await gql<any>(chairman, VITRINE)).marketplaceDefaultVitrine.id, 'витрина у кооператива одна').toBe(vitrine.id)
  })
})
