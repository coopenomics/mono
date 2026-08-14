<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { FailAlert } from 'src/shared/api'
import { BaseBadge, BaseInput, BaseSelect, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseSelectOption, BaseTableColumn } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import {
  buildStorageIndex,
  formatVolumeM3,
  listContainerTypes,
  listContainers,
  listStorageCells,
  volumeM3Of,
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
  return type ? formatVolumeM3(type.volume_m3) : '—'
}

// Порядок строк задаёт сама таблица (сортировка по клику на заголовок);
// здесь только отбор.
const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return containers.value.filter((c) => {
    if (branchFilter.value && c.braname !== branchFilter.value) return false
    if (!q) return true
    const hay = [c.code, c.label, cellCodeOf(c), typeNameOf(c), branchName(c.braname)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

/** Суммарный объём выборки — сколько места займёт перевозка этих боксов. */
const totalVolume = computed(() => {
  let sum = 0
  for (const c of rows.value) {
    const type = typeById.value.get(c.container_type_id)
    if (type) sum += volumeM3Of(type.volume_m3)
  }
  return formatVolumeM3(sum)
})

const filledCount = computed(
  () => rows.value.filter((c) => (countByContainer.value.get(c.id) ?? 0) > 0).length,
)

// Сортировка родная для таблицы: по участку, коду и типу — то, чем реально
// пользуются, когда ищут тару глазами. Объём и заполненность сортируются
// числом, иначе «10 м³» встало бы между «1 м³» и «2 м³».
const columns = computed<BaseTableColumn<MarketplaceContainerView>[]>(() => [
  {
    key: 'branch',
    label: 'Участок',
    width: '260px',
    sortable: true,
    field: (row) => branchName(row.braname),
  },
  { key: 'code', label: 'Код', width: '150px', sortable: true, field: 'code' },
  {
    key: 'type',
    label: 'Тип',
    width: '200px',
    sortable: true,
    field: (row) => typeNameOf(row),
  },
  {
    key: 'volume',
    label: 'Объём',
    width: '110px',
    numeric: true,
    nowrap: true,
    sortable: true,
    field: (row) => volumeM3Of(typeById.value.get(row.container_type_id)?.volume_m3),
  },
  { key: 'cell', label: 'Ячейка', width: '120px', field: (row) => cellCodeOf(row) },
  {
    key: 'count',
    label: 'Заполнен',
    width: '130px',
    sortable: true,
    field: (row) => countByContainer.value.get(row.id) ?? 0,
  },
])

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
    BaseInput.boxreg__search.field-flush(
      v-model='search',
      type='search',
      placeholder='Поиск: код бокса, адрес, тип, участок',
      clearable
    )
    BaseSelect.boxreg__branch.field-flush(
      v-model='branchFilter',
      :options='branchOptions',
      placeholder='Все участки'
    )

  BaseTable(
    v-if='loading || rows.length',
    :columns='columns',
    :rows='rows',
    row-key='id',
    hover,
    sticky-header,
    :loading='loading',
    :skeleton-rows='8',
    min-width='900px',
    sort-by='branch'
  )
    template(#cell-code='{ row }')
      span.boxreg__code {{ row.code }}
      .boxreg__sub(v-if='row.label') {{ row.label }}
    template(#cell-volume='{ row }')
      | {{ volumeOf(row) }}
    template(#cell-count='{ row }')
      BaseBadge(v-if='countByContainer.get(row.id)', variant='info')
        | {{ countByContainer.get(row.id) }} поз.
      BaseBadge(v-else, variant='neutral') Пусто
    template(#footer)
      span
        | Боксов: {{ rows.length }} · заполнено {{ filledCount }} · суммарный объём {{ totalVolume }}

  EmptyState(
    v-else,
    title='Боксы не найдены',
    body='В кооперативе ещё не заведена тара, либо ничего не подходит под фильтр. Боксы заводит оператор участка на своём столе.'
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
  }

  &__branch {
    flex: 0 1 260px;
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
}

@media (max-width: 768px) {
  .boxreg {
    padding: var(--p-4, 16px);
  }
}
</style>
