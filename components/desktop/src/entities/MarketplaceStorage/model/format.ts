import type {
  MarketplaceContainerView,
  MarketplacePlacement,
  MarketplaceStorageCellView,
} from './types'

/**
 * Позиция склада несёт только идентификаторы места (`container_id`/`cell_id`),
 * а человеку нужен адрес. Индекс собирается один раз на экран, дальше подписи
 * считаются без запросов.
 */
export interface StorageIndex {
  containerById: Map<string, MarketplaceContainerView>
  cellById: Map<string, MarketplaceStorageCellView>
}

export function buildStorageIndex(
  containers: readonly MarketplaceContainerView[],
  cells: readonly MarketplaceStorageCellView[],
): StorageIndex {
  return {
    containerById: new Map(containers.map((c) => [c.id, c])),
    cellById: new Map(cells.map((c) => [c.id, c])),
  }
}

export const EMPTY_STORAGE_INDEX: StorageIndex = {
  containerById: new Map(),
  cellById: new Map(),
}

/**
 * Подпись места хранения — зеркало серверного `formatInventoryLocation`, чтобы
 * лента выдачи (там подпись строит бэкенд) и складские экраны (здесь) говорили
 * об одном и том же одинаково.
 */
export function locationLabel(placement: MarketplacePlacement, index: StorageIndex): string {
  const container = placement.container_id
    ? index.containerById.get(placement.container_id) ?? null
    : null
  const cellId = container?.cell_id ?? placement.cell_id ?? null
  const cell = cellId ? index.cellById.get(cellId) ?? null : null

  if (container && cell) return `Бокс ${container.code} · ${cell.code}`
  if (container) return `Бокс ${container.code}`
  if (cell) return `Ячейка ${cell.code}`
  return 'Без места'
}

/** Адрес бокса для списков: «BX-0007 · A-02» либо «BX-0007» без адреса. */
export function containerLabel(
  container: MarketplaceContainerView,
  index: StorageIndex,
): string {
  const cell = container.cell_id ? index.cellById.get(container.cell_id) ?? null : null
  return cell ? `${container.code} · ${cell.code}` : container.code
}

/**
 * Что должно находиться омни-поиском по строке склада: код бокса и координата
 * ячейки. Оператор ищет «BX-0007» или «A-02», не выбирая режим поиска заранее.
 */
export function locationSearchTokens(
  placement: MarketplacePlacement,
  index: StorageIndex,
): string[] {
  const container = placement.container_id
    ? index.containerById.get(placement.container_id) ?? null
    : null
  const cellId = container?.cell_id ?? placement.cell_id ?? null
  const cell = cellId ? index.cellById.get(cellId) ?? null : null

  const tokens: string[] = []
  if (container) {
    tokens.push(container.code)
    if (container.label) tokens.push(container.label)
  }
  if (cell) {
    tokens.push(cell.code, cell.section)
    if (cell.label) tokens.push(cell.label)
  }
  return tokens
}

/** Объём в кубометрах из строки-десятичной дроби бэкенда; нечисло — 0. */
export function volumeM3Of(value: string | null | undefined): number {
  const n = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Объём тары в кубометрах — «0,3 м³», «10,25 м³».
 *
 * Обычно хватает сотых: перевозку прикидывают кубами, третий знак там уже шум.
 * Но фиксированная точность врёт на мелкой таре — объём схлопывается в «0 м³»,
 * и оператор видит ноль там, где объём есть. Поэтому знаков ровно столько,
 * сколько нужно, чтобы число не обнулилось: сколько посчитано, столько и
 * показываем.
 */
export function formatVolumeM3(value: string | number | null | undefined): string {
  const n = typeof value === 'number' ? value : volumeM3Of(value)
  if (!Number.isFinite(n) || n === 0) return '0 м³'

  const digits = n >= 0.01 ? 2 : Math.min(6, Math.ceil(-Math.log10(Math.abs(n))) + 1)
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: digits })} м³`
}
