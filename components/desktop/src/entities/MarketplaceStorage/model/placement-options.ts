import type { BaseSelectOption } from 'src/shared/ui/base'
import { containerLabel, type StorageIndex } from './format'
import type {
  MarketplaceContainerView,
  MarketplacePlacement,
  MarketplaceStorageCellView,
} from './types'

/**
 * Единый список «куда положить» для всех экранов, где выбирают место: раскладка,
 * склад участка и окно закрывающей подписи. Порядок и подписи обязаны совпадать —
 * иначе один и тот же бокс выглядел бы на трёх столах по-разному.
 */

export interface PlacementOptionsInput {
  containers: readonly MarketplaceContainerView[]
  cells: readonly MarketplaceStorageCellView[]
  index: StorageIndex
  /** Сколько позиций уже лежит в боксе — считает вызывающий по своему списку склада. */
  countOf: (containerId: string) => number
  containersEnabled: boolean
  cellsEnabled: boolean
}

const CONTAINER_PREFIX = 'container:'
const CELL_PREFIX = 'cell:'

/**
 * Пустые боксы идут первыми: чаще всего кладут в свободную тару. Занятые ниже,
 * с числом позиций — докладка в занятый бокс штатна (бокс большой, а привезли
 * две банки), и оператор должен видеть, что там уже лежит. Никакого автоподбора
 * «куда лучше» нет сознательно: решает человек, который держит коробку в руках.
 */
export function buildPlacementOptions(input: PlacementOptionsInput): BaseSelectOption[] {
  const out: BaseSelectOption[] = []

  if (input.containersEnabled) {
    const boxes = [...input.containers].sort((a, b) => {
      const diff = input.countOf(a.id) - input.countOf(b.id)
      return diff !== 0 ? diff : a.code.localeCompare(b.code, 'ru')
    })
    for (const container of boxes) {
      const count = input.countOf(container.id)
      out.push({
        value: `${CONTAINER_PREFIX}${container.id}`,
        label: `Бокс ${containerLabel(container, input.index)} — ${
          count ? `${count} поз.` : 'пусто'
        }`,
      })
    }
  }

  if (input.cellsEnabled) {
    for (const cell of input.cells) {
      out.push({
        value: `${CELL_PREFIX}${cell.id}`,
        label: `Ячейка ${cell.code} (негабарит)`,
      })
    }
  }

  return out
}

/** Значение выпадающего списка → пара идентификаторов места. */
export function parsePlacementValue(value: string | number | null | undefined): MarketplacePlacement {
  const raw = value === null || value === undefined ? '' : String(value)
  if (raw.startsWith(CONTAINER_PREFIX)) {
    return { container_id: raw.slice(CONTAINER_PREFIX.length), cell_id: null }
  }
  if (raw.startsWith(CELL_PREFIX)) {
    return { container_id: null, cell_id: raw.slice(CELL_PREFIX.length) }
  }
  return { container_id: null, cell_id: null }
}

/** Текущее место позиции → значение выпадающего списка. */
export function placementValueOf(placement: {
  container_id?: string | null
  cell_id?: string | null
}): string | null {
  if (placement.container_id) return `${CONTAINER_PREFIX}${placement.container_id}`
  if (placement.cell_id) return `${CELL_PREFIX}${placement.cell_id}`
  return null
}
