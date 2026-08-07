import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  listContainerTypes,
  listContainers,
  listStorageCells,
} from '../api'
import { buildStorageIndex } from './format'
import type {
  MarketplaceContainerTypeView,
  MarketplaceContainerView,
  MarketplaceStorageCellView,
} from './types'

const namespace = 'marketplaceStorageStore'

/** Что грузить: контур включается тремя независимыми флагами расширения. */
export interface StorageLoadScope {
  containers?: boolean
  cells?: boolean
}

/**
 * Места хранения кооперативного участка: ячейки «секция × ярус», боксы и
 * справочник их типов. Один стор на все складские экраны — они смотрят на одну
 * и ту же физическую расстановку, и расходиться ей нельзя.
 *
 * Загрузка идёт под конкретный участок: у оператора он один активный, у
 * администратора — сводный запрос без `braname` (бэкенд сам решит по правам,
 * `read:all` отдаёт все участки).
 */
export const useMarketplaceStorageStore = defineStore(namespace, () => {
  const cells = ref<MarketplaceStorageCellView[]>([])
  const containers = ref<MarketplaceContainerView[]>([])
  const types = ref<MarketplaceContainerTypeView[]>([])

  const loading = ref(false)
  const loadedBraname = ref<string | null>(null)
  const loaded = ref(false)

  /** Ячейки в обороте, отсортированные по адресу: секция, затем ярус снизу вверх. */
  const activeCells = computed(() =>
    cells.value
      .filter((c) => c.is_active)
      .sort((a, b) => a.section.localeCompare(b.section, 'ru') || a.level - b.level),
  )

  /** Боксы в обороте, по коду. */
  const activeContainers = computed(() =>
    containers.value
      .filter((c) => c.is_active)
      .sort((a, b) => a.code.localeCompare(b.code, 'ru')),
  )

  const activeTypes = computed(() => types.value.filter((t) => t.is_active))

  const index = computed(() => buildStorageIndex(containers.value, cells.value))

  /** Секции склада в порядке показа — столбцы координатной сетки. */
  const sections = computed(() => {
    const set = new Set<string>()
    for (const c of activeCells.value) set.add(c.section)
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  })

  /** Ярусы склада сверху вниз — строки координатной сетки. */
  const levels = computed(() => {
    const set = new Set<number>()
    for (const c of activeCells.value) set.add(c.level)
    return [...set].sort((a, b) => b - a)
  })

  function cellAt(section: string, level: number): MarketplaceStorageCellView | null {
    return (
      activeCells.value.find((c) => c.section === section && c.level === level) ?? null
    )
  }

  function typeById(id: string): MarketplaceContainerTypeView | null {
    return types.value.find((t) => t.id === id) ?? null
  }

  /**
   * Точечно поправить бокс в уже загруженном списке.
   *
   * Нужно перестановкам: карточка должна переехать в момент броска, а не через
   * два сетевых обхода (мутация + перезагрузка всего склада). Вызывающий
   * применяет изменение сразу, а при отказе сервера возвращает прежнее
   * значение этим же способом.
   */
  function patchContainer(
    id: string,
    patch: Partial<MarketplaceContainerView>,
  ): void {
    const idx = containers.value.findIndex((c) => c.id === id)
    const current = containers.value[idx]
    if (idx < 0 || !current) return
    containers.value[idx] = { ...current, ...patch }
  }

  /** Заменить бокс тем, что вернул сервер (после успешной мутации). */
  function applyContainer(next: MarketplaceContainerView): void {
    const idx = containers.value.findIndex((c) => c.id === next.id)
    if (idx >= 0) containers.value[idx] = next
    else containers.value.push(next)
  }

  /**
   * Применить ячейки, пришедшие с сервера, не перезагружая склад целиком:
   * известные заменяются, новые добавляются.
   *
   * Одним способом покрываются все правки сетки — заведение, переименование
   * секции и вывод координаты из оборота: во всех случаях сервер возвращает
   * актуальное состояние затронутых ячеек.
   */
  function applyCells(next: MarketplaceStorageCellView[]): void {
    if (!next.length) return
    const byId = new Map(next.map((c) => [c.id, c] as const))
    const merged = cells.value.map((c) => byId.get(c.id) ?? c)
    const knownIds = new Set(cells.value.map((c) => c.id))
    cells.value = [...merged, ...next.filter((c) => !knownIds.has(c.id))]
  }

  async function load(braname: string | null, scope: StorageLoadScope = {}): Promise<void> {
    const wantContainers = scope.containers ?? true
    const wantCells = scope.cells ?? true

    loading.value = true
    try {
      const data = braname ? { braname } : undefined
      const [nextCells, nextContainers, nextTypes] = await Promise.all([
        wantCells ? listStorageCells(data) : Promise.resolve([]),
        wantContainers ? listContainers(data) : Promise.resolve([]),
        wantContainers ? listContainerTypes() : Promise.resolve([]),
      ])
      cells.value = nextCells
      containers.value = nextContainers
      types.value = nextTypes
      loadedBraname.value = braname
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function ensureLoaded(
    braname: string | null,
    scope: StorageLoadScope = {},
  ): Promise<void> {
    if (loading.value) return
    if (loaded.value && loadedBraname.value === braname) return
    await load(braname, scope)
  }

  async function reload(scope: StorageLoadScope = {}): Promise<void> {
    await load(loadedBraname.value, scope)
  }

  function reset(): void {
    cells.value = []
    containers.value = []
    types.value = []
    loaded.value = false
    loadedBraname.value = null
  }

  return {
    cells,
    containers,
    types,
    loading,
    loaded,
    loadedBraname,
    activeCells,
    activeContainers,
    activeTypes,
    index,
    sections,
    levels,
    cellAt,
    typeById,
    patchContainer,
    applyContainer,
    applyCells,
    load,
    ensureLoaded,
    reload,
    reset,
  }
})
