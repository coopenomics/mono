/**
 * Стол заказов: адресное хранение склада участка — типы боксов, боксы, ячейки
 * (test-registry/marketplace.storage.yaml).
 *
 * Типы боксов — общий справочник кооператива, его ведёт председатель. Боксы и
 * ячейки принадлежат участку, их ведёт оператор этого участка: заводит боксы
 * партией, строит сетку ячеек, ставит бокс в ячейку своего участка и снимает
 * с адреса. Вывести из оборота можно только пустую ячейку.
 *
 * Секции теста носят метку прогона: на складе участка они не пересекаются с
 * чужими наборами. Заведённое выводится из оборота в конце каждого случая,
 * где это не мешает проверке.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, expectCode, gql, gqlError, tokenOf } from '../core'
import { KRG } from './flow'

const TYPE = 'id name length_cm width_cm height_cm volume_m3 max_weight_kg is_active'
const BOX = 'id code braname label container_type_id cell_id is_active'
const CELL = 'id code braname section level label is_active'

const CREATE_TYPE = `mutation($d:MarketplaceCreateContainerTypeInput!){ marketplaceCreateContainerType(data:$d){ ${TYPE} } }`
const LIST_TYPES = `query($a:Boolean){ marketplaceListContainerTypes(is_active:$a){ ${TYPE} } }`
const CREATE_BOXES = `mutation($d:MarketplaceCreateContainersInput!){ marketplaceCreateContainers(data:$d){ ${BOX} } }`
const LIST_BOXES = `query($d:MarketplaceListContainersInput){ marketplaceListContainers(data:$d){ ${BOX} } }`
const BY_CODE = `query($d:MarketplaceResolveContainerByCodeInput!){ marketplaceResolveContainerByCode(data:$d){ ${BOX} } }`
const MOVE = `mutation($d:MarketplaceMoveContainerInput!){ marketplaceMoveContainer(data:$d){ ${BOX} } }`
const UPDATE_BOX = `mutation($d:MarketplaceUpdateContainerInput!){ marketplaceUpdateContainer(data:$d){ ${BOX} } }`
const CREATE_CELL = `mutation($d:MarketplaceCreateStorageCellInput!){ marketplaceCreateStorageCell(data:$d){ ${CELL} } }`
const CREATE_GRID = `mutation($d:MarketplaceCreateStorageGridInput!){ marketplaceCreateStorageGrid(data:$d){ ${CELL} } }`
const LIST_CELLS = `query($d:MarketplaceListStorageCellsInput){ marketplaceListStorageCells(data:$d){ ${CELL} } }`
const UPDATE_CELL = `mutation($d:MarketplaceUpdateStorageCellInput!){ marketplaceUpdateStorageCell(data:$d){ ${CELL} } }`
const RENAME = `mutation($d:MarketplaceRenameStorageSectionInput!){ marketplaceRenameStorageSection(data:$d){ ${CELL} } }`
const RETIRE = `mutation($d:MarketplaceRetireStorageCellsInput!){ marketplaceRetireStorageCells(data:$d){ ${CELL} } }`

const ODN = 'odn'
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

let chairman = ''
let operator = ''
let foreignOperator = ''
let member = ''
let T = ''
let type: any
let boxes: any[] = []
let cells: any[] = []

/** Отказ по правам Стола заказов приходит кодом 403 без доменного имени. */
/** Негодный ввод: отсекает либо проверка ввода (422), либо правило склада со своим кодом. */
function invalid(err: { code: string | null } | null, domainCode: string): void {
  expect(err, `ожидался отказ ${domainCode}`).not.toBeNull()
  expect(['422', domainCode], JSON.stringify(err)).toContain(String(err!.code))
}

function denied(err: { code: string | null } | null): void {
  expect(err, 'ожидался отказ по правам').not.toBeNull()
  expect(['403', 'KIT_INSUFFICIENT_RIGHTS', 'MARKETPLACE_NOT_A_MEMBER']).toContain(String(err!.code))
}

async function cellsOf(section: string, token = operator): Promise<any[]> {
  const d = await gql<any>(token, LIST_CELLS, { d: { braname: KRG } })
  return (d.marketplaceListStorageCells as any[]).filter(c => c.section === section)
}

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  operator = await tokenOf(ROLES.branchChairman())
  foreignOperator = await tokenOf(ROLES.foreignBranchChairman())
  member = await tokenOf(ROLES.member())
  T = Date.now().toString(36).toUpperCase()
})

describe('Стол заказов — типы боксов', () => {
  it(caseName('mkt.store.happy.01', 'председатель заводит тип бокса — объём считается из габаритов, тип виден оператору участка'), async () => {
    type = (await gql<any>(chairman, CREATE_TYPE, {
      d: { name: `Ящик ${T}`, length_cm: 60, width_cm: 40, height_cm: 30, max_weight_kg: '25' },
    })).marketplaceCreateContainerType
    expect(type).toMatchObject({ name: `Ящик ${T}`, length_cm: 60, width_cm: 40, height_cm: 30, is_active: true })
    expect(Number(type.volume_m3)).toBeCloseTo(0.072, 6)
    expect(Number(type.max_weight_kg)).toBe(25)

    const seen = (await gql<any>(operator, LIST_TYPES, {})).marketplaceListContainerTypes
    expect(seen.map((t: any) => t.id)).toContain(type.id)
  })

  it(caseName('mkt.store.side.01', 'объём типа можно задать вручную; нулевой габарит и пустое название — отказ'), async () => {
    const manual = (await gql<any>(chairman, CREATE_TYPE, {
      d: { name: `Мешок ${T}`, length_cm: 100, width_cm: 50, height_cm: 20, volume_m3: '0.05' },
    })).marketplaceCreateContainerType
    expect(Number(manual.volume_m3)).toBeCloseTo(0.05, 6)

    invalid(
      await gqlError(chairman, CREATE_TYPE, { d: { name: `Плоский ${T}`, length_cm: 60, width_cm: 0, height_cm: 30 } }),
      'MARKETPLACE_CONTAINER_DIMENSION_MUST_BE_POSITIVE',
    )
    invalid(
      await gqlError(chairman, CREATE_TYPE, { d: { name: '   ', length_cm: 60, width_cm: 40, height_cm: 30 } }),
      'MARKETPLACE_CONTAINER_TYPE_NAME_REQUIRED',
    )
  })

  it(caseName('mkt.store.side.02', 'тип бокса заводит только председатель — оператору участка и пайщику отказ'), async () => {
    const input = { d: { name: `Чужой ${T}`, length_cm: 10, width_cm: 10, height_cm: 10 } }
    denied(await gqlError(operator, CREATE_TYPE, input))
    denied(await gqlError(member, CREATE_TYPE, input))
    const all = (await gql<any>(chairman, LIST_TYPES, {})).marketplaceListContainerTypes
    expect(all.map((t: any) => t.name)).not.toContain(`Чужой ${T}`)
  })
})

describe('Стол заказов — боксы участка', () => {
  it(caseName('mkt.store.happy.02', 'оператор заводит партию боксов — коды идут подряд, боксы без адреса и находятся по коду'), async () => {
    boxes = (await gql<any>(operator, CREATE_BOXES, {
      d: { braname: KRG, container_type_id: type.id, count: 3, label: `Партия ${T}` },
    })).marketplaceCreateContainers
    expect(boxes).toHaveLength(3)
    expect(new Set(boxes.map(b => b.code)).size, 'коды уникальны').toBe(3)
    for (const box of boxes)
      expect(box).toMatchObject({ braname: KRG, container_type_id: type.id, label: `Партия ${T}`, cell_id: null, is_active: true })

    const listed = (await gql<any>(operator, LIST_BOXES, { d: { braname: KRG, container_type_id: type.id } })).marketplaceListContainers
    expect(listed.map((b: any) => b.id).sort()).toEqual(boxes.map(b => b.id).sort())
    const unplaced = (await gql<any>(operator, LIST_BOXES, { d: { braname: KRG, container_type_id: type.id, unplaced_only: true } })).marketplaceListContainers
    expect(unplaced).toHaveLength(3)

    const found = (await gql<any>(operator, BY_CODE, { d: { code: boxes[0].code } })).marketplaceResolveContainerByCode
    expect(found.id).toBe(boxes[0].id)
  })

  it(caseName('mkt.store.side.03', 'партия с нулём боксов, с типом, которого нет, и сверх предела — отказ'), async () => {
    invalid(
      await gqlError(operator, CREATE_BOXES, { d: { braname: KRG, container_type_id: type.id, count: 0 } }),
      'MARKETPLACE_CONTAINER_COUNT_INVALID',
    )
    expectCode(
      await gqlError(operator, CREATE_BOXES, { d: { braname: KRG, container_type_id: UNKNOWN_ID, count: 1 } }),
      'MARKETPLACE_CONTAINER_TYPE_NOT_FOUND',
    )
    invalid(
      await gqlError(operator, CREATE_BOXES, { d: { braname: KRG, container_type_id: type.id, count: 100_000 } }),
      'MARKETPLACE_CONTAINER_BATCH_LIMIT_EXCEEDED',
    )
    expectCode(
      await gqlError(operator, BY_CODE, { d: { code: `НЕТ-${T}` } }),
      'MARKETPLACE_CONTAINER_NOT_FOUND_BY_CODE',
    )
  })

  it(caseName('mkt.store.side.04', 'боксы чужого участка оператор не заводит; пайщик боксов не видит и не заводит'), async () => {
    denied(await gqlError(foreignOperator, CREATE_BOXES, { d: { braname: KRG, container_type_id: type.id, count: 1 } }))
    denied(await gqlError(member, CREATE_BOXES, { d: { braname: KRG, container_type_id: type.id, count: 1 } }))
    denied(await gqlError(member, LIST_BOXES, { d: { braname: KRG } }))
    denied(await gqlError(foreignOperator, UPDATE_BOX, { d: { container_id: boxes[0].id, label: 'чужая подпись' } }))

    const listed = (await gql<any>(operator, LIST_BOXES, { d: { braname: KRG, container_type_id: type.id } })).marketplaceListContainers
    expect(listed).toHaveLength(3)
    expect(listed.find((b: any) => b.id === boxes[0].id).label).toBe(`Партия ${T}`)
  })
})

describe('Стол заказов — ячейки склада', () => {
  it(caseName('mkt.store.happy.03', 'оператор строит сетку ячеек — по ячейке на секцию и ярус; повтор сетки существующие ячейки не удваивает'), async () => {
    const a = `А${T}`
    const b = `Б${T}`
    cells = (await gql<any>(operator, CREATE_GRID, {
      d: { braname: KRG, sections: [a, b], level_from: 1, level_to: 2 },
    })).marketplaceCreateStorageGrid
    expect(cells).toHaveLength(4)
    expect(cells.map(c => `${c.section}/${c.level}`).sort()).toEqual([`${a}/1`, `${a}/2`, `${b}/1`, `${b}/2`].sort())
    expect(cells.every(c => c.braname === KRG && c.is_active)).toBe(true)
    expect(new Set(cells.map(c => c.code)).size).toBe(4)

    // Сетка шире прежней: старые ячейки остаются, добавляется только третий ярус.
    await gql<any>(operator, CREATE_GRID, { d: { braname: KRG, sections: [a], level_from: 1, level_to: 3 } })
    const sectionA = await cellsOf(a)
    expect(sectionA.map(c => c.level).sort()).toEqual([1, 2, 3])
    for (const old of cells.filter(c => c.section === a))
      expect(sectionA.find(c => c.id === old.id), 'прежняя ячейка на месте').toBeTruthy()
  })

  it(caseName('mkt.store.happy.04', 'одиночная ячейка заводится с подписью; подпись правится'), async () => {
    const section = `В${T}`
    const cell = (await gql<any>(operator, CREATE_CELL, { d: { braname: KRG, section, level: 1, label: 'У окна' } })).marketplaceCreateStorageCell
    expect(cell).toMatchObject({ braname: KRG, section, level: 1, label: 'У окна', is_active: true })

    const renamed = (await gql<any>(operator, UPDATE_CELL, { d: { cell_id: cell.id, label: 'У двери' } })).marketplaceUpdateStorageCell
    expect(renamed).toMatchObject({ id: cell.id, label: 'У двери', is_active: true })
    expect((await cellsOf(section))[0].label).toBe('У двери')
  })

  it(caseName('mkt.store.side.05', 'сетка без секций, с повтором секции и с перевёрнутым диапазоном ярусов — отказ'), async () => {
    invalid(await gqlError(operator, CREATE_GRID, { d: { braname: KRG, sections: [' '], level_from: 1, level_to: 1 } }), 'MARKETPLACE_STORAGE_CELL_SECTION_REQUIRED')
    invalid(await gqlError(operator, CREATE_GRID, { d: { braname: KRG, sections: ['X', 'X'], level_from: 1, level_to: 1 } }), 'MARKETPLACE_STORAGE_CELL_SECTIONS_DUPLICATE')
    invalid(await gqlError(operator, CREATE_GRID, { d: { braname: KRG, sections: ['X'], level_from: 3, level_to: 1 } }), 'MARKETPLACE_STORAGE_CELL_LEVEL_RANGE_INVALID')
    invalid(await gqlError(operator, CREATE_GRID, { d: { braname: KRG, sections: ['X'], level_from: 0, level_to: 1 } }), 'MARKETPLACE_STORAGE_CELL_LEVEL_RANGE_INVALID')
  })

  it(caseName('mkt.store.happy.05', 'секция переименовывается целиком; занятое название и секция, которой нет, — отказ'), async () => {
    const b = `Б${T}`
    const cold = `Холод${T}`
    const renamed = (await gql<any>(operator, RENAME, { d: { braname: KRG, section: b, new_section: cold } })).marketplaceRenameStorageSection
    expect(renamed).toHaveLength(2)
    expect(renamed.every((c: any) => c.section === cold)).toBe(true)
    expect(await cellsOf(b)).toEqual([])
    expect((await cellsOf(cold)).map(c => c.id).sort()).toEqual(cells.filter(c => c.section === b).map(c => c.id).sort())

    expectCode(await gqlError(operator, RENAME, { d: { braname: KRG, section: cold, new_section: `А${T}` } }), 'MARKETPLACE_STORAGE_CELL_SECTION_NAME_TAKEN')
    expectCode(await gqlError(operator, RENAME, { d: { braname: KRG, section: `Нет${T}`, new_section: `Новая${T}` } }), 'MARKETPLACE_STORAGE_CELL_SECTION_NOT_FOUND')
  })

  it(caseName('mkt.store.side.06', 'ячейки чужого участка оператор не ведёт; пайщик склада не видит'), async () => {
    denied(await gqlError(foreignOperator, CREATE_CELL, { d: { braname: KRG, section: `Чужая${T}`, level: 1 } }))
    denied(await gqlError(foreignOperator, RETIRE, { d: { braname: KRG, section: `А${T}` } }))
    denied(await gqlError(member, LIST_CELLS, { d: { braname: KRG } }))
    expect(await cellsOf(`Чужая${T}`)).toEqual([])
  })
})

describe('Стол заказов — бокс на адресе', () => {
  it(caseName('mkt.store.happy.06', 'бокс ставится в ячейку своего участка, переставляется и снимается с адреса'), async () => {
    const [first, second] = await cellsOf(`А${T}`)
    const placed = (await gql<any>(operator, MOVE, { d: { container_id: boxes[0].id, cell_id: first.id } })).marketplaceMoveContainer
    expect(placed.cell_id).toBe(first.id)

    const moved = (await gql<any>(operator, MOVE, { d: { container_id: boxes[0].id, cell_id: second.id } })).marketplaceMoveContainer
    expect(moved.cell_id).toBe(second.id)
    const unplaced = (await gql<any>(operator, LIST_BOXES, { d: { braname: KRG, container_type_id: type.id, unplaced_only: true } })).marketplaceListContainers
    expect(unplaced.map((b: any) => b.id)).not.toContain(boxes[0].id)

    const freed = (await gql<any>(operator, MOVE, { d: { container_id: boxes[0].id, cell_id: null } })).marketplaceMoveContainer
    expect(freed.cell_id).toBeNull()
  })

  it(caseName('mkt.store.side.07', 'в ячейку чужого участка и в ячейку, которой нет, бокс не ставится'), async () => {
    const foreignCell = (await gql<any>(foreignOperator, CREATE_CELL, { d: { braname: ODN, section: `Г${T}`, level: 1 } })).marketplaceCreateStorageCell
    expectCode(
      await gqlError(operator, MOVE, { d: { container_id: boxes[0].id, cell_id: foreignCell.id } }),
      'MARKETPLACE_CONTAINER_CELL_BRANCH_MISMATCH',
    )
    expectCode(
      await gqlError(operator, MOVE, { d: { container_id: boxes[0].id, cell_id: UNKNOWN_ID } }),
      'MARKETPLACE_CELL_NOT_FOUND',
    )
    expectCode(
      await gqlError(operator, MOVE, { d: { container_id: UNKNOWN_ID, cell_id: null } }),
      'MARKETPLACE_CONTAINER_NOT_FOUND',
    )
    await gql(foreignOperator, UPDATE_CELL, { d: { cell_id: foreignCell.id, is_active: false } })
  })

  it(caseName('mkt.store.side.08', 'ячейку с боксом из оборота не вывести; пустая выводится, и в выведенную бокс не ставится'), async () => {
    const [first, second] = await cellsOf(`А${T}`)
    await gql(operator, MOVE, { d: { container_id: boxes[1].id, cell_id: first.id } })

    expect(await gqlError(operator, UPDATE_CELL, { d: { cell_id: first.id, is_active: false } }), 'занятая ячейка').not.toBeNull()
    expect((await cellsOf(`А${T}`)).find(c => c.id === first.id).is_active).toBe(true)

    const retired = (await gql<any>(operator, UPDATE_CELL, { d: { cell_id: second.id, is_active: false } })).marketplaceUpdateStorageCell
    expect(retired.is_active).toBe(false)
    expectCode(
      await gqlError(operator, MOVE, { d: { container_id: boxes[2].id, cell_id: second.id } }),
      'MARKETPLACE_CELL_DECOMMISSIONED',
    )
    const active = (await gql<any>(operator, LIST_CELLS, { d: { braname: KRG, is_active: true } })).marketplaceListStorageCells
    expect(active.map((c: any) => c.id)).not.toContain(second.id)
  })

  it(caseName('mkt.store.happy.07', 'секция с боксом целиком не разбирается; после снятия бокса секция выводится из оборота, пустой бокс — тоже'), async () => {
    const a = `А${T}`
    expect(await gqlError(operator, RETIRE, { d: { braname: KRG, section: a } }), 'в секции стоит бокс').not.toBeNull()
    expectCode(await gqlError(operator, RETIRE, { d: { braname: KRG, section: a, level: 1 } }), 'MARKETPLACE_STORAGE_CELL_SECTION_OR_LEVEL_ONLY')
    expectCode(await gqlError(operator, RETIRE, { d: { braname: KRG } }), 'MARKETPLACE_STORAGE_CELL_SECTION_OR_LEVEL_ONLY')

    await gql(operator, MOVE, { d: { container_id: boxes[1].id, cell_id: null } })
    const retired = (await gql<any>(operator, RETIRE, { d: { braname: KRG, section: a } })).marketplaceRetireStorageCells
    expect(retired.length).toBeGreaterThan(0)
    expect(retired.every((c: any) => c.section === a && c.is_active === false)).toBe(true)
    expect((await cellsOf(a)).every(c => c.is_active === false)).toBe(true)

    for (const box of boxes) {
      const off = (await gql<any>(operator, UPDATE_BOX, { d: { container_id: box.id, is_active: false, label: `Списан ${T}` } })).marketplaceUpdateContainer
      expect(off).toMatchObject({ id: box.id, is_active: false, label: `Списан ${T}` })
    }
    const inUse = (await gql<any>(operator, LIST_BOXES, { d: { braname: KRG, container_type_id: type.id, is_active: true } })).marketplaceListContainers
    expect(inUse).toEqual([])
    for (const section of [`Холод${T}`, `В${T}`])
      await gql(operator, RETIRE, { d: { braname: KRG, section } })
  })
})
