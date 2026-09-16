<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useFirstLoad } from 'src/shared/lib/composables'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import {
  BaseBadge,
  BaseButton,
  BaseDialog,
  BaseInput,
  BaseSelect,
  BaseTable,
  EmptyState,
} from 'src/shared/ui/base'
import type { BaseSelectOption, BaseTableColumn } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { ContainerContentsDrawer } from 'src/widgets/Marketplace/ContainerContentsDrawer'
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace'
import { useDesktopStore } from 'src/entities/Desktop'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import {
  buildStorageIndex,
  createContainerType,
  formatVolumeM3,
  listContainerTypes,
  listContainers,
  listStorageCells,
  volumeM3Of,
  type MarketplaceContainerTypeView,
  type MarketplaceContainerView,
  type MarketplaceStorageCellView,
} from 'src/entities/MarketplaceStorage'
import {
  isOnWarehouse,
  listInventory,
  type MarketplaceInventoryItemView,
} from 'src/entities/MarketplaceInventory'

/**
 * Стол администратора: тара всего кооператива.
 *
 * Два раздела. «Боксы» — свод: сколько тары на каком участке стоит, чем она
 * занята и какой объём займёт её перевозка (оператор видит только свой
 * участок, а машину под перевозку считают по кооперативу). «Типы боксов» —
 * общий справочник габаритов: тару закупают одинаковыми партиями, и объём
 * должен считаться по одной линейке на всех участках, поэтому типы заводит
 * председатель здесь, а участки только выбирают готовый тип при заведении
 * боксов (решение владельца 14.09.2026).
 *
 * Страница видна, только когда в настройках расширения включены боксы: backend
 * не выдаёт право `Container:read:all` при выключенном контуре, и маршрут
 * скрывается сам.
 */

const route = useRoute()
const coopname = computed(() => String(route.params.coopname ?? ''))
const kuStore = useMarketplaceKUDetailsStore()
const desktop = useDesktopStore()

const tab = ref<'containers' | 'types'>('containers')

/** Заводить типы тары может только председатель — у совета раздел читающий. */
const canManageTypes = computed(() => desktop.hasGrant('market-admin', 'Container:manage:types'))

function onSelectTab(selected: PageTab): void {
  tab.value = selected.key === 'types' ? 'types' : 'containers'
}

const tabs = computed<PageTab[]>(() => [
  { key: 'containers', label: 'Боксы', count: containers.value.length },
  { key: 'types', label: 'Типы боксов', count: types.value.length },
])

const containers = ref<MarketplaceContainerView[]>([])
const cells = ref<MarketplaceStorageCellView[]>([])
const types = ref<MarketplaceContainerTypeView[]>([])
const inventory = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(true)
/** Каркас и пустое состояние — по первой загрузке; дочитка обновляет молча. */
const firstLoad = useFirstLoad(loading)

const search = ref('')
const branchFilter = ref<string | null>(null)

const index = computed(() => buildStorageIndex(containers.value, cells.value))

const typeById = computed(
  () => new Map(types.value.map((t) => [t.id, t] as const)),
)

// ─── Содержимое бокса ───
// Реестр отвечает «сколько позиций», а смотрящему нужно «что именно лежит»:
// строка открывает боковую панель с составом. Позиции склада уже загружены
// вместе с реестром, поэтому панель ничего не дозапрашивает.
const openedContainer = ref<MarketplaceContainerView | null>(null)
const contentsOpen = ref(false)

function openContainer(container: MarketplaceContainerView): void {
  openedContainer.value = container
  contentsOpen.value = true
}

// В боксе лежит только то, что на складе: выданное и списанное покидает
// участок и место за собой не держит.
const openedItems = computed(() =>
  openedContainer.value
    ? inventory.value.filter(
        (i) => i.container_id === openedContainer.value?.id && isOnWarehouse(i.status),
      )
    : [],
)

/** Сколько позиций лежит в каждом боксе — считается из склада, не с бэкенда. */
const countByContainer = computed(() => {
  const map = new Map<string, number>()
  for (const item of inventory.value) {
    if (!item.container_id || !isOnWarehouse(item.status)) continue
    map.set(item.container_id, (map.get(item.container_id) ?? 0) + 1)
  }
  return map
})

/**
 * Наименование участка вместо служебного кода. Адрес идёт отдельной строкой
 * под наименованием (как на складе): адрес отвечает «куда ехать», а называют
 * участок по организации — «РОМАШКА», а не «Москва, ул. Мира д.1».
 */
function branchName(braname: string): string {
  const details = kuStore.details.find((d) => d.coreBraname === braname)
  return details?.name?.trim() || details?.addressFull || braname
}

function branchAddress(braname: string): string {
  const details = kuStore.details.find((d) => d.coreBraname === braname)
  const address = details?.addressFull?.trim() ?? ''
  // Адрес не дублируем, когда он же и подставлен вместо наименования.
  return address && address !== branchName(braname) ? address : ''
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

const typeColumns = computed<BaseTableColumn<MarketplaceContainerTypeView>[]>(() => [
  { key: 'name', label: 'Название', sortable: true, field: 'name' },
  { key: 'dims', label: 'Габариты, см', width: '200px', nowrap: true },
  {
    key: 'volume',
    label: 'Объём',
    width: '110px',
    numeric: true,
    nowrap: true,
    sortable: true,
    field: (row) => volumeM3Of(row.volume_m3),
  },
  { key: 'weight', label: 'Макс. вес', width: '120px', nowrap: true },
  {
    key: 'boxes',
    label: 'Боксов',
    width: '100px',
    numeric: true,
    sortable: true,
    field: (row) => containers.value.filter((c) => c.container_type_id === row.id).length,
  },
])

// ─── Завести тип боксов ───
const typeOpen = ref(false)
const typeSaving = ref(false)
interface ContainerTypeForm {
  name: string
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  max_weight_kg: string
}

function emptyTypeForm(): ContainerTypeForm {
  return { name: '', length_cm: null, width_cm: null, height_cm: null, max_weight_kg: '' }
}

const typeForm = ref<ContainerTypeForm>(emptyTypeForm())

const typeValid = computed(
  () =>
    typeForm.value.name.trim().length > 0 &&
    Number(typeForm.value.length_cm) > 0 &&
    Number(typeForm.value.width_cm) > 0 &&
    Number(typeForm.value.height_cm) > 0,
)

/** Объём считает бэкенд, но председатель должен видеть его до сохранения. */
const typeVolumePreview = computed(() => {
  const l = Number(typeForm.value.length_cm)
  const w = Number(typeForm.value.width_cm)
  const h = Number(typeForm.value.height_cm)
  if (!(l > 0 && w > 0 && h > 0)) return ''
  return formatVolumeM3(String((l * w * h) / 1_000_000))
})

function openType(): void {
  typeForm.value = emptyTypeForm()
  typeOpen.value = true
}

async function submitType(): Promise<void> {
  if (!typeValid.value) return
  typeSaving.value = true
  try {
    await createContainerType({
      name: typeForm.value.name.trim(),
      length_cm: Math.trunc(Number(typeForm.value.length_cm)),
      width_cm: Math.trunc(Number(typeForm.value.width_cm)),
      height_cm: Math.trunc(Number(typeForm.value.height_cm)),
      max_weight_kg: typeForm.value.max_weight_kg.trim() || null,
    })
    SuccessAlert('Тип боксов заведён')
    typeOpen.value = false
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось завести тип боксов')
  } finally {
    typeSaving.value = false
  }
}

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
  Teleport(to='#header-actions-host', defer)
    BaseButton(
      v-if='tab === "types" && canManageTypes',
      variant='primary',
      size='sm',
      @click='openType'
    )
      template(#icon-left)
        q-icon(name='add', size='16px')
      | Тип боксов

  //- Канон: одна подсказка на страницу, над полосой разделов. Оба раздела —
  //- про одну и ту же тару, поэтому и текст один.
  PageHint(storage-key='mp:admin-containers:banner-dismissed')
    | Вся тара кооператива: где стоит бокс, какого он типа и чем занят. Объём
    | суммируется по текущей выборке — по нему считается, сколько места займёт
    | перевозка боксов между участками. Сами боксы заводит участок на своём
    | столе, а типы тары — общие: габариты задаются здесь один раз на весь
    | кооператив, и участок при заведении боксов выбирает готовый тип.

  PageTabs(:tabs='tabs', :active-key='tab', @select='onSelectTab')

  template(v-if='tab === "containers"')
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
      v-if='firstLoad || rows.length',
      :columns='columns',
      :rows='rows',
      row-key='id',
      hover,
      sticky-header,
      :loading='loading',
      :skeleton-rows='8',
      min-width='900px',
      sort-by='branch',
      clickable-rows,
      @row-click='openContainer'
    )
      template(#cell-branch='{ row }')
        .boxreg__branch-cell
          span.boxreg__branch-name {{ branchName(row.braname) }}
          span.boxreg__sub(v-if='branchAddress(row.braname)') {{ branchAddress(row.braname) }}
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
      body='В кооперативе ещё не заведена тара, либо ничего не подходит под фильтр. Боксы заводит участок на своём столе — в разделе «Склад».'
    )
      template(#icon)
        q-icon(name='inbox', size='48px')

  //- ────────────────────────── Типы боксов ──────────────────────
  template(v-else)
    BaseTable(
      v-if='firstLoad || types.length',
      :columns='typeColumns',
      :rows='types',
      row-key='id',
      hover,
      :loading='loading',
      :skeleton-rows='4',
      min-width='720px',
      sort-by='name'
    )
      template(#cell-dims='{ row }')
        | {{ row.length_cm }} × {{ row.width_cm }} × {{ row.height_cm }}
      template(#cell-volume='{ row }')
        | {{ formatVolumeM3(row.volume_m3) }}
      template(#cell-weight='{ row }')
        | {{ row.max_weight_kg ? `${row.max_weight_kg} кг` : '—' }}

    EmptyState(
      v-else,
      title='Типы боксов не заведены',
      body='Тип задаёт габариты и объём тары. Заведите его первым — дальше участки создают боксы партиями одного типа.'
    )
      template(#icon)
        q-icon(name='straighten', size='48px')

  ContainerContentsDrawer(
    v-model='contentsOpen',
    :container='openedContainer',
    :items='openedItems',
    :branch-name='openedContainer ? branchName(openedContainer.braname) : ""',
    :branch-address='openedContainer ? branchAddress(openedContainer.braname) : ""',
    :type-name='openedContainer ? typeNameOf(openedContainer) : ""',
    :volume='openedContainer ? volumeOf(openedContainer) : ""',
    :cell-code='openedContainer ? cellCodeOf(openedContainer) : ""'
  )

  //- ─────────────────────── Диалог: тип боксов ───────────────────────
  BaseDialog(v-model='typeOpen', title='Тип боксов', size='sm')
    .boxreg__form
      .boxreg__note
        | Габариты задаются в сантиметрах — так тару меряют на месте. По ним
        | считается объём в кубометрах: он показывает, какая машина увезёт
        | партию боксов между участками.
      BaseInput(v-model='typeForm.name', label='Название', placeholder='Ящик 60×40×30')
      .boxreg__dims
        BaseInput(v-model.number='typeForm.length_cm', type='number', label='Длина, см')
        BaseInput(v-model.number='typeForm.width_cm', type='number', label='Ширина, см')
        BaseInput(v-model.number='typeForm.height_cm', type='number', label='Высота, см')
      BaseInput(v-model='typeForm.max_weight_kg', label='Предельный вес, кг', placeholder='Необязательно')
      .boxreg__note(v-if='typeVolumePreview') Полезный объём: {{ typeVolumePreview }}
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='typeSaving', @click='typeOpen = false') Отмена
      BaseButton(
        variant='primary',
        size='sm',
        :loading='typeSaving',
        :disabled='!typeValid',
        @click='submitType'
      ) Завести
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

  &__branch-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__branch-name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__sub {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__dims {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--p-2, 8px);
  }

  &__note {
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
  }
}

@media (max-width: 768px) {
  .boxreg {
    padding: var(--p-4, 16px);
  }
}
</style>
