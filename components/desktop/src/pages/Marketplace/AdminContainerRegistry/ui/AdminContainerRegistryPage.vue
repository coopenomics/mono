<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { FailAlert } from 'src/shared/api'
import { BaseBadge, BaseInput, BaseSelect, EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { BaseSelectOption, TableSkeletonColumn } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import {
  buildStorageIndex,
  formatVolumeLiters,
  listContainerTypes,
  listContainers,
  listStorageCells,
  volumeLitersOf,
  type MarketplaceContainerTypeView,
  type MarketplaceContainerView,
  type MarketplaceStorageCellView,
} from 'src/entities/MarketplaceStorage'
import { listInventory, type MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory'

/**
 * Стол администратора: боксы всего кооператива.
 *
 * Оператор видит только тару своего участка — этого достаточно, чтобы разложить
 * привезённое. Кооперативу же нужен свод: сколько тары где стоит, чем она занята
 * и какой объём займёт её перевозка. Суммарный объём по текущей выборке — задел
 * под перемещение боксов между участками, где нужно посчитать машину.
 *
 * Страница видна, только когда в настройках расширения включены боксы: backend
 * не выдаёт право `Container:read:all` при выключенном контуре, и маршрут
 * скрывается сам.
 */

const route = useRoute()
const coopname = computed(() => String(route.params.coopname ?? ''))
const kuStore = useMarketplaceKUDetailsStore()

const containers = ref<MarketplaceContainerView[]>([])
const cells = ref<MarketplaceStorageCellView[]>([])
const types = ref<MarketplaceContainerTypeView[]>([])
const inventory = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(true)

const search = ref('')
const branchFilter = ref<string | null>(null)

const index = computed(() => buildStorageIndex(containers.value, cells.value))

const typeById = computed(
  () => new Map(types.value.map((t) => [t.id, t] as const)),
)

/** Сколько позиций лежит в каждом боксе — считается из склада, не с бэкенда. */
const countByContainer = computed(() => {
  const map = new Map<string, number>()
  for (const item of inventory.value) {
    if (!item.container_id) continue
    map.set(item.container_id, (map.get(item.container_id) ?? 0) + 1)
  }
  return map
})

/** Человеческое имя участка вместо служебного кода. */
function branchName(braname: string): string {
  const details = kuStore.details.find((d) => d.coreBraname === braname)
  return details?.addressFull || braname
}

const branchOptions = computed<BaseSelectOption[]>(() => {
  const set = new Set(containers.value.map((c) => c.braname))
  return [...set]
    .sort((a, b) => branchName(a).localeCompare(branchName(b), 'ru'))
    .map((braname) => ({ value: braname, label: branchName(braname) }))
})

function cellCodeOf(container: MarketplaceContainerView): string {
  if (!container.cell_id) return '—'
  return index.value.cellById.get(container.cell_id)?.code ?? '—'
}

function typeNameOf(container: MarketplaceContainerView): string {
  return typeById.value.get(container.container_type_id)?.name ?? '—'
}

function volumeOf(container: MarketplaceContainerView): string {
  const type = typeById.value.get(container.container_type_id)
  return type ? formatVolumeLiters(type.volume_liters) : '—'
}

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return containers.value
    .filter((c) => {
      if (branchFilter.value && c.braname !== branchFilter.value) return false
      if (!q) return true
      const hay = [c.code, c.label, cellCodeOf(c), typeNameOf(c), branchName(c.braname)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
    .sort(
      (a, b) =>
        branchName(a.braname).localeCompare(branchName(b.braname), 'ru') ||
        a.code.localeCompare(b.code, 'ru'),
    )
})

/** Суммарный объём выборки — сколько места займёт перевозка этих боксов. */
const totalVolume = computed(() => {
  let sum = 0
  for (const c of rows.value) {
    const type = typeById.value.get(c.container_type_id)
    if (type) sum += volumeLitersOf(type.volume_liters)
  }
  return `${sum.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} л`
})

const filledCount = computed(
  () => rows.value.filter((c) => (countByContainer.value.get(c.id) ?? 0) > 0).length,
)

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Участок', class: 'col-branch', cell: 'text' },
  { label: 'Код', class: 'col-code', cell: 'text' },
  { label: 'Тип', cell: 'text' },
  { label: 'Объём', class: 'col-volume', cell: 'text' },
  { label: 'Ячейка', class: 'col-cell', cell: 'text' },
  { label: 'Заполнен', class: 'col-count', cell: 'badge' },
]

async function load(): Promise<void> {
  loading.value = true
  try {
    const [nextContainers, nextCells, nextTypes, nextInventory] = await Promise.all([
      listContainers(),
      listStorageCells(),
      listContainerTypes(),
      listInventory(),
    ])
    containers.value = nextContainers
    cells.value = nextCells
    types.value = nextTypes
    inventory.value = nextInventory
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить реестр боксов')
  } finally {
    loading.value = false
  }
}

// Realtime вместо кнопки «Обновить»: заполненность боксов двигают приёмки,
// выдачи и исполненные списания — те же сигналы, что и сводный склад.
const reloadLive = debounce(() => {
  if (loading.value) return
  void load()
}, 400)
useMarketplaceRealtime(
  {
    MarketplaceAplReceptionStatusChangedEvent: () => reloadLive(),
    MarketplaceOrderStatusChangedEvent: () => reloadLive(),
    MarketplaceWriteoffStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() },
)

onMounted(async () => {
  // Имена участков — best-effort: без них реестр покажет служебные коды, но
  // работать не перестанет.
  await Promise.all([
    load(),
    kuStore.load({ coopname: coopname.value, onlyActive: false }).catch(() => undefined),
  ])
})
</script>

<template lang="pug">
q-page.boxreg(role='region', aria-label='Боксы кооператива')
  PageHint(storage-key='mp:admin-containers:banner-dismissed')
    | Вся тара кооператива: где стоит бокс, какого он типа и чем занят. Объём
    | суммируется по текущей выборке — по нему считается, сколько места займёт
    | перевозка боксов между участками.

  .boxreg__filters
    BaseInput.boxreg__search(
      v-model='search',
      type='search',
      placeholder='Поиск: код бокса, адрес, тип, участок',
      clearable
    )
    BaseSelect.boxreg__branch(
      v-model='branchFilter',
      :options='branchOptions',
      placeholder='Все участки'
    )

  TableSkeleton(
    v-if='loading && !containers.length',
    :columns='skeletonColumns',
    :rows='8',
    min-width='900px'
  )

  .table-wrap(v-else-if='rows.length')
    .table-scroll
      table.table
        thead
          tr
            th.col-branch Участок
            th.col-code Код
            th.col-type Тип
            th.col-volume Объём
            th.col-cell Ячейка
            th.col-count Заполнен
        tbody
          tr(v-for='c in rows', :key='c.id')
            td.col-branch.boxreg__branch-cell {{ branchName(c.braname) }}
            td.col-code
              span.boxreg__code {{ c.code }}
              .boxreg__sub(v-if='c.label') {{ c.label }}
            td.col-type {{ typeNameOf(c) }}
            td.col-volume {{ volumeOf(c) }}
            td.col-cell {{ cellCodeOf(c) }}
            td.col-count
              BaseBadge(v-if='countByContainer.get(c.id)', variant='info')
                | {{ countByContainer.get(c.id) }} поз.
              BaseBadge(v-else, variant='neutral') Пусто

    .table-foot
      span
        | Боксов: {{ rows.length }} · заполнено {{ filledCount }} · суммарный объём {{ totalVolume }}

  EmptyState(
    v-else,
    title='Боксы не найдены',
    body='В кооперативе ещё не заведена тара, либо ничего не подходит под фильтр. Боксы заводит председатель участка на своём столе.'
  )
    template(#icon)
      q-icon(name='inbox', size='48px')
</template>

<style scoped lang="scss">
.boxreg {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__filters {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__search {
    flex: 1 1 320px;
    max-width: 420px;

    // Ни поиск, ни фильтр не показывают hint/error — снимаем резерв строки под
    // них, иначе между рядом фильтров и таблицей висит пустой промежуток.
    :deep(.q-field__bottom) {
      min-height: 0;
      padding-top: 0;
    }
  }

  &__branch {
    flex: 0 1 260px;

    :deep(.q-field__bottom) {
      min-height: 0;
      padding-top: 0;
    }
  }

  &__code {
    font-family: var(--p-mono);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__sub {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  &__branch-cell {
    overflow-wrap: anywhere;
  }
}

.table-scroll {
  overflow-x: auto;
}
// Сумма ширин колонок = min-width: колонки не схлопываются, а на узком экране
// включается горизонтальная прокрутка вместо наезжающих друг на друга ячеек.
.table {
  table-layout: fixed;
  min-width: 900px;
}

.col-branch {
  width: 260px;
}
.col-code {
  width: 150px;
}
.col-type {
  width: 200px;
}
.col-volume {
  width: 110px;
  white-space: nowrap;
}
.col-cell {
  width: 120px;
}
.col-count {
  width: 130px;
}

@media (max-width: 768px) {
  .boxreg {
    padding: var(--p-4, 16px);
  }
}
</style>
