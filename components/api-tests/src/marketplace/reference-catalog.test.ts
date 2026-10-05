/**
 * Стол заказов: внешний справочник категорий и витрина кооператива
 * (test-registry/marketplace.reference-catalog.yaml).
 *
 * Справочник (дерево категорий и типы товаров) заполняется вне платформы:
 * загрузчика у узла нет, на свежем кооперативе он пуст. По нему кооператив
 * выбирает доступные категории. Витрина по умолчанию заводится при установке
 * Стола заказов.
 *
 * Заявки на товар, характеристики и словари первой версии Стола заказов
 * убраны 03.10.2026 (C28-87): ими никто не пользовался.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, caseName, gql, tokenOf } from '../core'

const AVAILABLE_TREE = 'query{ marketplaceGetAvailableCategoryTree{ descriptionCategoryId categoryName childrenCount } }'
const VITRINE = 'query{ marketplaceDefaultVitrine{ id coopname display_name is_default } }'

let chairman = ''
let member = ''

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  member = await tokenOf(ROLES.member())
})

describe('Стол заказов — внешний справочник категорий', () => {
  it(caseName('mkt.ref.happy.01', 'справочник свежего кооператива пуст: дерево доступных категорий отвечает пустым списком'), async () => {
    expect((await gql<any>(chairman, AVAILABLE_TREE)).marketplaceGetAvailableCategoryTree).toEqual([])
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
