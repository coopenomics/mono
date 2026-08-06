<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay'
import { CodeScanner, BARCODE_FORMATS } from 'src/widgets/Marketplace/CodeScanner'
import {
  BaseBadge,
  BaseButton,
  BaseCheckbox,
  BaseDialog,
  BaseInput,
  BaseSelect,
  CardListSkeleton,
  EmptyState,
} from 'src/shared/ui/base'
import type { BaseSelectOption } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { useMarketplaceRealtime, printLabelSheet } from 'src/shared/lib/marketplace'
import {
  containerLabel,
  createStorageGrid,
  locationLabel,
  moveContainer,
  useMarketplaceStorageStore,
  type MarketplaceContainerView,
  type MarketplaceStorageCellView,
} from 'src/entities/MarketplaceStorage'
import {
  assignInventoryPlacement,
  listInventory,
  type MarketplaceInventoryItemView,
} from 'src/entities/MarketplaceInventory'
import {
  bindInventoryBarcode,
  clearInventoryLabel,
  splitInventory,
} from '../api'

/**
 * Стол ПВЗ, «Раскладка и маркировка».
 *
 * Склад участка — не лента полок, а адресная сетка: столбцы это секции, строки
 * ярусы, на пересечении ячейка со своим адресом (A-02). В ячейке стоят боксы, а
 * негабарит, который в тару не влезает, кладётся в ячейку напрямую. Так склад
 * ищется адресом и работает одинаково на десяти позициях и на десяти тысячах.
 *
 * Контур опционален. При выключенных ячейках сетки нет вовсе — имущество просто
 * складывается в боксы («наполнил и поставил в угол», самая ходовая модель).
 * При выключенных и боксах, и ячейках страница остаётся столом маркировки:
 * штрих-коды и разбиение по количеству работают как прежде.
 *
 * Маркировка = наклеить заранее напечатанный штрих-код и привязать его к позиции
 * сканером. Она независима от размещения и остаётся необязательной.
 */

const route = useRoute()
const branchStore = useOperatorBranchStore()
const storage = useMarketplaceStorageStore()

const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => branchStore.activeBraname ?? '')

const containersEnabled = computed(() => branchStore.warehouseSettings.containers_enabled)
const cellsEnabled = computed(() => branchStore.warehouseSettings.cells_enabled)
const placementEnabled = computed(() => branchStore.addressedStorageEnabled)

const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(true)

const RECEIVED = Zeus.MarketplaceInventoryStatus.RECEIVED
const LABELED = Zeus.MarketplaceInventoryStatus.LABELED

/** ФИО заказчика (с бэка), иначе служебный аккаунт — для подписи на карточке. */
function ordererLabel(item: MarketplaceInventoryItemView): string {
  return item.orderer_name?.trim() || item.orderer_account_snapshot
}

// Имущество на складе (принятое/промаркированное) — то, что раскладываем.
const boardItems = computed(() =>
  items.value.filter((i) => i.status === RECEIVED || i.status === LABELED),
)

// ─── Поиск и фильтр ───
const search = ref('')
const onlyNonEmpty = ref(false)

const query = computed(() => search.value.trim().toLowerCase())

function matchesItem(item: MarketplaceInventoryItemView): boolean {
  if (!query.value) return true
  const hay = [item.product_name_snapshot, ordererLabel(item), item.barcode_value]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(query.value)
}

function matchesContainer(container: MarketplaceContainerView): boolean {
  if (!query.value) return true
  const own = [container.code, container.label].filter(Boolean).join(' ').toLowerCase()
  if (own.includes(query.value)) return true
  // Бокс находится и по тому, что внутри: оператор ищет товар, а не тару.
  return itemsInContainer(container.id).some(matchesItem)
}

function matchesCell(cell: MarketplaceStorageCellView): boolean {
  if (!query.value) return true
  const own = [cell.code, cell.section, cell.label].filter(Boolean).join(' ').toLowerCase()
  return own.includes(query.value)
}

// ─── Раскладка позиций по местам ───
function itemsInContainer(containerId: string): MarketplaceInventoryItemView[] {
  return boardItems.value.filter((i) => i.container_id === containerId)
}

function itemsInCell(cellId: string): MarketplaceInventoryItemView[] {
  return boardItems.value.filter((i) => i.cell_id === cellId)
}

/** Не размещённое: ни в боксе, ни в ячейке. Это и есть колонка «Поступило». */
const inboxItems = computed(() =>
  boardItems.value.filter((i) => !i.container_id && !i.cell_id).filter(matchesItem),
)

function containersInCell(cellId: string): MarketplaceContainerView[] {
  return storage.activeContainers.filter((c) => c.cell_id === cellId)
}

/** Боксы без адреса — они существуют штатно: «наполнил и поставил в угол». */
const unplacedContainers = computed(() =>
  storage.activeContainers.filter((c) => !c.cell_id).filter(matchesContainer),
)

function visibleContainersInCell(cellId: string): MarketplaceContainerView[] {
  return containersInCell(cellId).filter(matchesContainer)
}

function visibleItemsInCell(cellId: string): MarketplaceInventoryItemView[] {
  return itemsInCell(cellId).filter(matchesItem)
}

function cellHasContent(cell: MarketplaceStorageCellView): boolean {
  return (
    visibleContainersInCell(cell.id).length > 0 || visibleItemsInCell(cell.id).length > 0
  )
}

/**
 * Показывать ли ячейку. Пока не ищут и не включён фильтр — видны все, включая
 * пустые: пустая ячейка это место, куда кладут, а не отсутствие данных.
 */
function cellVisible(cell: MarketplaceStorageCellView): boolean {
  if (query.value) return matchesCell(cell) || cellHasContent(cell)
  if (onlyNonEmpty.value) return cellHasContent(cell)
  return true
}

const visibleSections = computed(() =>
  storage.sections.filter((section) =>
    storage.activeCells.some((c) => c.section === section && cellVisible(c)),
  ),
)

const visibleLevels = computed(() =>
  storage.levels.filter((level) =>
    storage.activeCells.some((c) => c.level === level && cellVisible(c)),
  ),
)

/**
 * Сетка считается заранее, а не вызовами из шаблона: так координата ищется один
 * раз на отрисовку, а не на каждое обращение к ячейке, и содержимое каждой
 * ячейки лежит рядом с ней готовым.
 */
interface GridSlot {
  section: string
  cell: MarketplaceStorageCellView | null
  boxes: MarketplaceContainerView[]
  loose: MarketplaceInventoryItemView[]
}
interface GridRow {
  level: number
  slots: GridSlot[]
}

const gridRows = computed<GridRow[]>(() =>
  visibleLevels.value.map((level) => ({
    level,
    slots: visibleSections.value.map((section) => {
      const cell = storage.cellAt(section, level)
      const visible = cell !== null && cellVisible(cell)
      return {
        section,
        cell: visible ? cell : null,
        boxes: visible && cell ? visibleContainersInCell(cell.id) : [],
        loose: visible && cell ? visibleItemsInCell(cell.id) : [],
      }
    }),
  })),
)

// ─── Перераскладка (split) по количеству: непромаркированный пул заказа ──
function orderPool(item: MarketplaceInventoryItemView): MarketplaceInventoryItemView[] {
  return items.value.filter(
    (i) => i.order_id === item.order_id && i.status === RECEIVED && !i.barcode_value,
  )
}
function orderPoolTotal(item: MarketplaceInventoryItemView): number {
  return orderPool(item).reduce((a, p) => a + p.quantity_per_label, 0)
}
function canRedistribute(item: MarketplaceInventoryItemView): boolean {
  return !item.barcode_value && orderPoolTotal(item) >= 2
}

async function load(): Promise<void> {
  if (!braname.value.trim()) {
    items.value = []
    return
  }
  loading.value = true
  try {
    const [list] = await Promise.all([
      listInventory({ braname: braname.value.trim() }),
      storage.load(braname.value.trim(), {
        containers: containersEnabled.value,
        cells: cellsEnabled.value,
      }),
    ])
    items.value = list
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить склад участка')
  } finally {
    loading.value = false
  }
}

// ─── Перекладка позиции: в бокс, в ячейку либо снятие с места ──
async function movePlacement(
  item: MarketplaceInventoryItemView,
  placement: { container_id?: string | null; cell_id?: string | null },
): Promise<void> {
  const nextContainer = placement.container_id ?? null
  const nextCell = placement.cell_id ?? null
  if ((item.container_id ?? null) === nextContainer && (item.cell_id ?? null) === nextCell) {
    return
  }
  try {
    await assignInventoryPlacement({
      inventory_id: item.id,
      container_id: nextContainer,
      cell_id: nextCell,
    })
    SuccessAlert(
      nextContainer || nextCell
        ? `Переложено: ${locationLabel({ container_id: nextContainer, cell_id: nextCell }, storage.index)}`
        : 'Снято с места',
    )
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось переложить позицию')
  }
}

// ─── Снять штрих-код для переклейки (LABELED → RECEIVED) ──
async function removeLabel(item: MarketplaceInventoryItemView): Promise<void> {
  try {
    await clearInventoryLabel({ inventory_id: item.id })
    SuccessAlert('Штрих-код снят — позицию можно переклеить')
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось снять штрих-код')
  }
}

// ─── Drag & drop: перетаскиваем и позиции, и боксы ──
// Вид перетаскиваемого важен: позиция ложится в бокс или ячейку, бокс — только
// в ячейку. Без различения бокс «падал» бы внутрь другого бокса.
type DragKind = 'item' | 'container'
const dragKind = ref<DragKind | null>(null)
const dragId = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)

function onDragStart(kind: DragKind, id: string): void {
  dragKind.value = kind
  dragId.value = id
}
function onDragEnd(): void {
  dragKind.value = null
  dragId.value = null
  dragOverKey.value = null
}

function dropOnCell(cell: MarketplaceStorageCellView): void {
  const kind = dragKind.value
  const id = dragId.value
  onDragEnd()
  if (!kind || !id) return
  if (kind === 'container') {
    void placeContainer(id, cell.id)
    return
  }
  const item = items.value.find((i) => i.id === id)
  if (item) void movePlacement(item, { cell_id: cell.id })
}

function dropOnContainer(container: MarketplaceContainerView): void {
  const kind = dragKind.value
  const id = dragId.value
  onDragEnd()
  if (kind !== 'item' || !id) return
  const item = items.value.find((i) => i.id === id)
  if (item) void movePlacement(item, { container_id: container.id })
}

function dropOnInbox(): void {
  const kind = dragKind.value
  const id = dragId.value
  onDragEnd()
  if (!kind || !id) return
  if (kind === 'container') {
    void placeContainer(id, null)
    return
  }
  const item = items.value.find((i) => i.id === id)
  if (item) void movePlacement(item, {})
}

async function placeContainer(containerId: string, cellId: string | null): Promise<void> {
  try {
    const moved = await moveContainer({ container_id: containerId, cell_id: cellId })
    SuccessAlert(
      cellId ? `Бокс ${moved.code} переставлен` : `Бокс ${moved.code} снят с адреса`,
    )
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось переставить бокс')
  }
}

// ─── Варианты мест для выпадающих списков ──
// Пустые боксы идут первыми: чаще всего кладут в свободную тару, а докладка в
// занятый бокс — штатный, но второй по частоте сценарий.
const placementOptions = computed<BaseSelectOption[]>(() => {
  const out: BaseSelectOption[] = []
  if (containersEnabled.value) {
    const boxes = [...storage.activeContainers].sort((a, b) => {
      const diff = itemsInContainer(a.id).length - itemsInContainer(b.id).length
      return diff !== 0 ? diff : a.code.localeCompare(b.code, 'ru')
    })
    for (const c of boxes) {
      const count = itemsInContainer(c.id).length
      out.push({
        value: `container:${c.id}`,
        label: `Бокс ${containerLabel(c, storage.index)} — ${count ? `${count} поз.` : 'пусто'}`,
      })
    }
  }
  if (cellsEnabled.value) {
    for (const cell of storage.activeCells) {
      out.push({ value: `cell:${cell.id}`, label: `Ячейка ${cell.code} (негабарит)` })
    }
  }
  return out
})

/** Значение выпадающего списка → пара идентификаторов места. */
function parsePlacementOption(value: string | number | null): {
  container_id: string | null
  cell_id: string | null
} {
  const raw = value === null || value === undefined ? '' : String(value)
  if (raw.startsWith('container:')) return { container_id: raw.slice(10), cell_id: null }
  if (raw.startsWith('cell:')) return { container_id: null, cell_id: raw.slice(5) }
  return { container_id: null, cell_id: null }
}

function placementOptionOf(item: {
  container_id?: string | null
  cell_id?: string | null
}): string | null {
  if (item.container_id) return `container:${item.container_id}`
  if (item.cell_id) return `cell:${item.cell_id}`
  return null
}

// ─── Содержимое бокса ──
const boxDialogOpen = ref(false)
const boxTarget = ref<MarketplaceContainerView | null>(null)

function openBox(container: MarketplaceContainerView): void {
  boxTarget.value = container
  boxDialogOpen.value = true
}

const boxItems = computed(() =>
  boxTarget.value ? itemsInContainer(boxTarget.value.id) : [],
)

// ─── Управление сеткой ──
const gridOpen = ref(false)
const gridSections = ref('')
const gridLevelFrom = ref<number | null>(1)
const gridLevelTo = ref<number | null>(3)
const gridSaving = ref(false)

const gridSectionList = computed(() =>
  gridSections.value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean),
)

const gridValid = computed(
  () =>
    gridSectionList.value.length > 0 &&
    Number(gridLevelFrom.value) >= 1 &&
    Number(gridLevelTo.value) >= Number(gridLevelFrom.value),
)

function openGrid(): void {
  gridSections.value = ''
  gridLevelFrom.value = 1
  gridLevelTo.value = 3
  gridOpen.value = true
}

async function submitGrid(): Promise<void> {
  if (!gridValid.value) return
  gridSaving.value = true
  try {
    const created = await createStorageGrid({
      braname: braname.value.trim(),
      sections: gridSectionList.value,
      level_from: Math.trunc(Number(gridLevelFrom.value)),
      level_to: Math.trunc(Number(gridLevelTo.value)),
    })
    SuccessAlert(
      created.length
        ? `Заведено ячеек: ${created.length}`
        : 'Все такие ячейки уже существуют',
    )
    gridOpen.value = false
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось завести ячейки')
  } finally {
    gridSaving.value = false
  }
}

// ─── Генерация произвольного EAN-13 (12 цифр + контрольная) ──
function randomEAN13(): string {
  let base = ''
  for (let i = 0; i < 12; i++) base += Math.floor(Math.random() * 10).toString()
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3)
  const check = (10 - (sum % 10)) % 10
  return `${base}${check}`
}

// ─── Печать листа произвольных штрих-кодов (для нарезки и наклейки) ──
const printDialogOpen = ref(false)
const printCount = ref<number | null>(24)

function openPrintDialog(): void {
  printDialogOpen.value = true
}

// SVG-полосы штрих-кода (тот же псевдо-рендер, что и в BarcodeDisplay) — строкой,
// чтобы печатать изолированный лист, а не весь UI приложения.
function barcodeSvg(code: string): string {
  const rects: { x: number; w: number }[] = []
  let x = 4
  for (let i = 0; i < code.length; i++) {
    const ch = code.charCodeAt(i)
    const blackW = ((ch * 7) % 4) + 1
    const gapW = ((ch * 11) % 3) + 1
    rects.push({ x, w: blackW })
    x += blackW + gapW
    if (i % 2 === 0) {
      rects.push({ x, w: 1 })
      x += 2
    }
  }
  const last = rects[rects.length - 1]
  const total = (last ? last.x + last.w : 100) + 8
  const bars = rects
    .map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="64" fill="#111"/>`)
    .join('')
  return `<svg viewBox="0 0 ${total} 64" width="${total}" height="64" role="img" aria-label="Штрих-код ${code}">${bars}</svg>`
}

function doPrint(): void {
  const n = Math.trunc(Number(printCount.value) || 0)
  if (n < 1) return
  printDialogOpen.value = false
  const labels = Array.from({ length: n }, () => {
    const code = randomEAN13()
    return `${barcodeSvg(code)}<div class="code">${code}</div>`
  })
  printLabelSheet({ title: 'Этикетки', labels })
}

// ─── Привязка штрих-кода к позиции ──
// Сканируем камерой устройства (CodeScanner), либо ручной ввод/USB-сканер в
// запасном поле виджета. Считанный код привязывается сразу — без отдельной кнопки.
const scanDialogOpen = ref(false)
const scanTarget = ref<MarketplaceInventoryItemView | null>(null)
const binding = ref(false)

function openScan(item: MarketplaceInventoryItemView): void {
  scanTarget.value = item
  scanDialogOpen.value = true
}

async function submitScan(raw: string): Promise<void> {
  const item = scanTarget.value
  const code = raw.trim()
  if (!item || !code || binding.value) return
  binding.value = true
  try {
    await bindInventoryBarcode({ inventory_id: item.id, barcode_value: code })
    SuccessAlert(`Штрих-код ${code} привязан к позиции`)
    scanDialogOpen.value = false
    scanTarget.value = null
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось привязать штрих-код')
  } finally {
    binding.value = false
  }
}

// ─── Раскладка по количеству на несколько мест (split/merge/move) ──
const splitDialogOpen = ref(false)
const splitTarget = ref<MarketplaceInventoryItemView | null>(null)
const splitRows = ref<{ quantity: number | null; placement: string | null }[]>([])

const splitTotal = computed(() =>
  splitRows.value.reduce((a, r) => a + (Number(r.quantity) || 0), 0),
)
const splitPoolTotal = computed(() =>
  splitTarget.value ? orderPoolTotal(splitTarget.value) : 0,
)
const splitValid = computed(
  () =>
    !!splitTarget.value &&
    splitRows.value.length >= 1 &&
    splitRows.value.every((r) => Number(r.quantity) > 0) &&
    splitTotal.value === splitPoolTotal.value,
)

function openSplit(item: MarketplaceInventoryItemView): void {
  splitTarget.value = item
  const pool = orderPool(item)
  splitRows.value = pool.map((p) => ({
    quantity: p.quantity_per_label as number | null,
    placement: placementOptionOf(p),
  }))
  if (splitRows.value.length === 1) splitRows.value.push({ quantity: null, placement: null })
  splitDialogOpen.value = true
}

function addSplitRow(): void {
  splitRows.value.push({ quantity: null, placement: null })
}
function removeSplitRow(idx: number): void {
  splitRows.value.splice(idx, 1)
}

const splitting = ref(false)

async function applySplit(): Promise<void> {
  if (!splitTarget.value || !splitValid.value) return
  const target = splitTarget.value
  splitting.value = true
  try {
    await splitInventory({
      inventory_id: target.id,
      splits: splitRows.value.map((r) => ({
        quantity: Number(r.quantity),
        ...parsePlacementOption(r.placement),
      })),
    })
    SuccessAlert(
      splitRows.value.length > 1
        ? `Заказ разложен на ${splitRows.value.length} мест(а)`
        : 'Заказ собран на одном месте',
    )
    splitDialogOpen.value = false
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось разложить позицию')
  } finally {
    splitting.value = false
  }
}

watch(braname, () => void load())

// Realtime вместо кнопки «Обновить»: склад пополняется закрывающей подписью
// председателя (акт → ACCEPTED_TO_COOP), пустеет подписью выдачи заказчиком
// (заказ → RECEIVED). Оба сигнала приходят в служебный канал персонала КУ.
const reloadLive = debounce(() => {
  if (loading.value) return
  void load()
}, 400)
useMarketplaceRealtime(
  {
    MarketplaceAplReceptionStatusChangedEvent: (event) => {
      if (event.braname === braname.value.trim()) reloadLive()
    },
    MarketplaceOrderStatusChangedEvent: () => reloadLive(),
    // Исполненное списание тоже опустошает склад.
    MarketplaceWriteoffStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() },
)

onMounted(async () => {
  await branchStore.ensureLoaded(coopname.value)
  void load()
})
</script>

<template lang="pug">
q-page.place(role='region', aria-label='Раскладка и маркировка')
  OperatorBranchBar

  EmptyState(
    v-if='branchStore.loaded && !branchStore.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Раскладка имущества доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    Teleport(to='#header-actions-host', defer)
      .place__head-actions
        BaseButton(v-if='cellsEnabled', variant='secondary', size='sm', @click='openGrid')
          template(#icon-left)
            q-icon(name='grid_view', size='16px')
          | Сетка склада
        BaseButton(variant='secondary', size='sm', @click='openPrintDialog')
          template(#icon-left)
            q-icon(name='print', size='16px')
          | Печать этикеток

    PageHint(storage-key='mp:operator-labeling:banner-dismissed')
      template(v-if='cellsEnabled')
        | Склад адресный: столбцы — секции, строки — ярусы, на пересечении ячейка
        | со своим адресом. Перетащите позицию в бокс или прямо в ячейку, если она
        | негабаритная. Бокс тоже перетаскивается — целиком, вместе с содержимым.
      template(v-else-if='containersEnabled')
        | Разложите принятое имущество по боксам — при выдаче заказчику сразу
        | видно, в какой таре что лежит. Адрес боксу не обязателен: наполнили и
        | поставили. Штрих-код — по желанию, для поиска сканером.
      template(v-else)
        | Наклейте на принятое имущество штрих-коды и привяжите их сканером —
        | тогда при выдаче позиция находится за секунду. Адресное хранение
        | (боксы и ячейки) выключено в настройках расширения.

    //- Канон загрузки: скелетон, а не спиннер.
    CardListSkeleton(v-if='loading && !items.length', :count='3')

    EmptyState(
      v-else-if='!boardItems.length',
      title='На складе пусто',
      body='Здесь появятся принятые позиции — после приёмки партии на столе «Ожидаемые поставки».'
    )
      template(#icon)
        q-icon(name='inventory_2', size='48px')

    template(v-else)
      //- Поиск и фильтр — отдельной строкой: у поля и переключателя разные
      //- высоты, в одном ряду поле «скачет» относительно переключателя.
      .place__filters
        BaseInput.place__search(
          v-model='search',
          type='search',
          placeholder='Поиск: адрес, бокс, товар, заказчик',
          clearable
        )
        BaseCheckbox(
          v-if='cellsEnabled',
          v-model='onlyNonEmpty',
          label='Только непустые ячейки'
        )

      .place__layout
        //- ─────────────── Поступило: не размещённое имущество ───────────────
        .place__inbox(
          :class='{ "is-over": dragOverKey === "__inbox__", "place__inbox--solo": !placementEnabled }',
          @dragover.prevent='dragOverKey = "__inbox__"',
          @dragleave='dragOverKey = (dragOverKey === "__inbox__" ? null : dragOverKey)',
          @drop='dropOnInbox'
        )
          .place__col-head
            q-icon(name='inbox', size='18px')
            span.place__col-title Поступило
            BaseBadge(variant='neutral') {{ inboxItems.length }}

          .place__col-body
            .place__empty-drop(v-if='!inboxItems.length')
              | {{ placementEnabled ? 'Всё разложено' : 'Ничего не найдено' }}

            .place__card(
              v-for='item in inboxItems',
              :key='item.id',
              :draggable='placementEnabled',
              :class='{ "is-dragging": dragId === item.id }',
              @dragstart='onDragStart("item", item.id)',
              @dragend='onDragEnd'
            )
              .place__card-top
                .place__card-info
                  .place__card-name {{ item.product_name_snapshot || 'Товар по предложению' }}
                  .place__card-meta {{ item.quantity_per_label }} ед. · {{ ordererLabel(item) }}
                .place__card-actions
                  BaseButton(
                    v-if='!item.barcode_value',
                    variant='ghost',
                    size='sm',
                    icon-only,
                    aria-label='Привязать штрих-код сканером',
                    @click='openScan(item)'
                  )
                    template(#icon-left)
                      q-icon(name='qr_code_scanner', size='18px')
                      q-tooltip Привязать штрих-код сканером
                  BaseButton(variant='ghost', size='sm', icon-only, aria-label='Действия')
                    template(#icon-left)
                      q-icon(name='more_vert', size='18px')
                      q-menu(anchor='bottom right', self='top right')
                        q-list(dense, style='min-width: 240px')
                          template(v-if='placementEnabled')
                            q-item-label(header) Положить
                            q-item(
                              v-for='opt in placementOptions',
                              :key='opt.value',
                              clickable,
                              v-close-popup,
                              @click='movePlacement(item, parsePlacementOption(opt.value))'
                            )
                              q-item-section {{ opt.label }}
                            q-separator
                          q-item(
                            v-if='canRedistribute(item)',
                            clickable,
                            v-close-popup,
                            @click='openSplit(item)'
                          )
                            q-item-section(avatar)
                              q-icon(name='call_split', size='18px')
                            q-item-section Разложить по количеству
                          q-item(
                            v-if='item.barcode_value',
                            clickable,
                            v-close-popup,
                            @click='removeLabel(item)'
                          )
                            q-item-section(avatar)
                              q-icon(name='label_off', size='18px')
                            q-item-section Снять штрих-код

              .place__card-badges
                BaseBadge(v-if='item.barcode_value', variant='pos') Промаркировано
                BaseBadge(v-else, variant='neutral') Без штрих-кода

              BarcodeDisplay(v-if='item.barcode_value', :code='item.barcode_value', size='sm')

        //- ─────────────── Координатная сетка склада ───────────────
        .place__grid-wrap(v-if='cellsEnabled')
          EmptyState(
            v-if='!storage.activeCells.length',
            title='Сетка склада не заведена',
            body='Опишите склад координатами: секции по горизонтали, ярусы по вертикали. Тогда место находится адресом, а не перебором.'
          )
            template(#icon)
              q-icon(name='grid_view', size='48px')

          EmptyState(
            v-else-if='!visibleSections.length',
            title='Ничего не найдено',
            body='Ни одна ячейка не подходит под поиск или фильтр.'
          )
            template(#icon)
              q-icon(name='search_off', size='48px')

          .place__grid-scroll(v-else)
            table.place__grid
              thead
                tr
                  th.place__grid-corner Ярус
                  th(v-for='section in visibleSections', :key='section') {{ section }}
              tbody
                tr(v-for='row in gridRows', :key='row.level')
                  th.place__grid-level {{ row.level }}
                  td(v-for='slot in row.slots', :key='slot.section')
                    .place__cell(
                      v-if='slot.cell',
                      :class='{ "is-over": dragOverKey === `cell:${slot.cell.id}` }',
                      @dragover.prevent='dragOverKey = `cell:${slot.cell.id}`',
                      @dragleave='dragOverKey = null',
                      @drop='dropOnCell(slot.cell)'
                    )
                      .place__cell-head
                        span.place__cell-code {{ slot.cell.code }}
                      .place__cell-body
                        .place__box(
                          v-for='box in slot.boxes',
                          :key='box.id',
                          draggable='true',
                          :class='{ "is-dragging": dragId === box.id, "is-over": dragOverKey === `box:${box.id}` }',
                          @dragstart.stop='onDragStart("container", box.id)',
                          @dragend='onDragEnd',
                          @dragover.prevent.stop='dragOverKey = `box:${box.id}`',
                          @drop.stop='dropOnContainer(box)',
                          @click='openBox(box)'
                        )
                          q-icon(name='inbox', size='16px')
                          span.place__box-code {{ box.code }}
                          BaseBadge(variant='neutral') {{ itemsInContainer(box.id).length }}

                        .place__mini(
                          v-for='item in slot.loose',
                          :key='item.id',
                          draggable='true',
                          :class='{ "is-dragging": dragId === item.id }',
                          @dragstart='onDragStart("item", item.id)',
                          @dragend='onDragEnd'
                        )
                          span.place__mini-name {{ item.product_name_snapshot || 'Товар' }}
                          span.place__mini-qty {{ item.quantity_per_label }}

        //- ─────────────── Боксы без адреса (или весь список без сетки) ───────
        .place__boxes(v-if='containersEnabled')
          .place__col-head
            q-icon(name='inbox', size='18px')
            span.place__col-title {{ cellsEnabled ? 'Боксы без адреса' : 'Боксы участка' }}
            BaseBadge(variant='neutral') {{ unplacedContainers.length }}

          .place__empty-drop(v-if='!unplacedContainers.length')
            | {{ cellsEnabled ? 'Все боксы расставлены' : 'Боксы не заведены — заведите их на столе «Боксы»' }}

          .place__box-list
            .place__box.place__box--wide(
              v-for='box in unplacedContainers',
              :key='box.id',
              draggable='true',
              :class='{ "is-dragging": dragId === box.id, "is-over": dragOverKey === `box:${box.id}` }',
              @dragstart='onDragStart("container", box.id)',
              @dragend='onDragEnd',
              @dragover.prevent='dragOverKey = `box:${box.id}`',
              @dragleave='dragOverKey = null',
              @drop='dropOnContainer(box)',
              @click='openBox(box)'
            )
              q-icon(name='inbox', size='16px')
              span.place__box-code {{ box.code }}
              span.place__box-note(v-if='box.label') {{ box.label }}
              BaseBadge(variant='neutral') {{ itemsInContainer(box.id).length }}

  //- ─────────────────────── Содержимое бокса ───────────────────────
  BaseDialog(v-model='boxDialogOpen', :title='boxTarget ? `Бокс ${boxTarget.code}` : "Бокс"', size='md')
    .place__box-dialog(v-if='boxTarget')
      .place__note {{ containerLabel(boxTarget, storage.index) }} · позиций: {{ boxItems.length }}

      EmptyState(v-if='!boxItems.length', title='Бокс пуст', body='Перетащите в него позицию из «Поступило».')
        template(#icon)
          q-icon(name='inbox', size='40px')

      .place__box-row(v-for='item in boxItems', :key='item.id')
        .place__card-info
          .place__card-name {{ item.product_name_snapshot || 'Товар' }}
          .place__card-meta {{ item.quantity_per_label }} ед. · {{ ordererLabel(item) }}
        BaseButton(variant='ghost', size='sm', @click='movePlacement(item, {})') Вынуть
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='boxDialogOpen = false') Закрыть

  //- ─────────────────────── Сетка склада ───────────────────────
  BaseDialog(v-model='gridOpen', title='Сетка склада', size='sm')
    .place__form
      .place__note
        | Секции — это столбцы склада (A, B, «Холодильник»), ярусы — строки.
        | Перечислите секции через запятую и задайте диапазон ярусов; уже
        | существующие координаты пропускаются.
      BaseInput(v-model='gridSections', label='Секции', placeholder='A, B, C')
      .place__levels
        BaseInput(v-model.number='gridLevelFrom', type='number', label='Ярус с')
        BaseInput(v-model.number='gridLevelTo', type='number', label='по')
      .place__note(v-if='gridValid')
        | Будет заведено ячеек: {{ gridSectionList.length * (Number(gridLevelTo) - Number(gridLevelFrom) + 1) }}
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='gridSaving', @click='gridOpen = false') Отмена
      BaseButton(variant='primary', size='sm', :loading='gridSaving', :disabled='!gridValid', @click='submitGrid') Завести

  //- ─────────────────────── Раскладка по количеству ───────────────────────
  BaseDialog(v-model='splitDialogOpen', title='Разложить по местам', size='md')
    .place__split(v-if='splitTarget')
      .place__split-head
        | {{ splitTarget.product_name_snapshot || 'Товар' }} — всего {{ splitPoolTotal }} ед.
      .place__note
        | Распределите весь заказ по местам. Чтобы собрать обратно в одно место —
        | удалите лишние строки; чтобы разложить иначе — измените количества и места.
      .place__split-row(v-for='(row, idx) in splitRows', :key='idx')
        BaseInput.place__split-qty(v-model.number='row.quantity', type='number', label='Кол-во')
        BaseSelect.place__split-place(
          v-if='placementEnabled',
          v-model='row.placement',
          :options='placementOptions',
          label='Место'
        )
        BaseButton(
          variant='ghost',
          size='sm',
          icon-only,
          :disabled='splitRows.length <= 1',
          aria-label='Удалить долю',
          @click='removeSplitRow(idx)'
        )
          template(#icon-left)
            q-icon(name='close', size='16px')
      .place__split-foot
        BaseButton(variant='ghost', size='sm', @click='addSplitRow')
          template(#icon-left)
            q-icon(name='add', size='16px')
          | Ещё доля
        span.place__split-total(:class='{ "place__split-total--bad": splitTotal !== splitPoolTotal }')
          | Сумма: {{ splitTotal }} / {{ splitPoolTotal }}
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='splitDialogOpen = false') Отмена
      BaseButton(variant='primary', size='sm', :loading='splitting', :disabled='!splitValid', @click='applySplit') Разложить

  //- ─────────────────────── Печать штрих-кодов ───────────────────────
  BaseDialog(v-model='printDialogOpen', title='Печать этикеток', size='sm')
    .place__form
      .place__note
        | Сколько штрих-кодов напечатать? Распечатайте лист, разрежьте и наклейте
        | этикетки на имущество — затем привяжите их к позициям сканером.
      BaseInput(
        v-model.number='printCount',
        type='number',
        label='Количество этикеток',
        @keydown.enter='doPrint'
      )
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='printDialogOpen = false') Отмена
      BaseButton(variant='primary', size='sm', :disabled='!printCount || printCount < 1', @click='doPrint') Печать

  //- ─────────────────────── Привязка штрих-кода ───────────────────────
  //- Считанный код привязывается сразу, отдельной кнопки «Привязать» не нужно.
  BaseDialog(v-model='scanDialogOpen', title='Привязать штрих-код', size='sm')
    .place__form
      .place__note(v-if='scanTarget')
        | {{ scanTarget.product_name_snapshot || 'Товар' }} — наведите камеру на
        | наклеенный штрих-код, либо введите его номер вручную. Код привяжется сразу.
      CodeScanner(
        :formats='BARCODE_FORMATS',
        idle-caption='Наведите камеру на штрих-код имущества',
        frame-hint='Поместите штрих-код в рамку',
        start-label='Включить камеру',
        manual-label='Или введите штрих-код',
        manual-placeholder='4600000000000',
        manual-button='Привязать',
        @scanned='submitScan'
      )
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='binding', @click='scanDialogOpen = false') Закрыть
</template>

<style scoped lang="scss">
.place {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__head-actions {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: var(--p-4, 16px);
    flex-wrap: wrap;
  }

  &__search {
    max-width: 420px;
    width: 100%;

    // Поиск не показывает hint/error — снимаем резерв строки под них, иначе
    // между полем и сеткой висит пустой промежуток.
    :deep(.q-field__bottom) {
      min-height: 0;
      padding-top: 0;
    }
  }

  // Слева — «Поступило» фиксированной ширины, справа — сетка на всё остальное.
  &__layout {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__inbox {
    flex: 0 0 300px;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-3, 12px);
    max-height: calc(100vh - 260px);
    transition: border-color var(--p-dur-fast, 0.12s) var(--p-ease-standard);

    &.is-over {
      border-color: var(--p-primary);
    }

    // Адресное хранение выключено — раскладывать некуда, и «Поступило»
    // занимает страницу целиком как обычный список для маркировки.
    &--solo {
      flex: 1 1 100%;
    }
  }

  &__col-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    color: var(--p-ink);
  }

  &__col-title {
    flex: 1 1 auto;
    font-weight: 600;
    font-size: var(--p-fs-body, 14px);
    overflow-wrap: anywhere;
  }

  &__col-body {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    overflow-y: auto;
  }

  &__empty-drop {
    border: 1px dashed var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    padding: var(--p-4, 16px);
    text-align: center;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__card {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    background: var(--p-surface-2);
    padding: var(--p-3, 12px);
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    cursor: grab;

    &.is-dragging {
      opacity: 0.5;
    }

    &:active {
      cursor: grabbing;
    }
  }

  &__card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-2, 8px);
  }

  &__card-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__card-name {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__card-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__card-actions {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    flex: 0 0 auto;
  }

  &__card-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-1, 4px);
  }

  // ─── Координатная сетка ───
  &__grid-wrap {
    flex: 1 1 480px;
    min-width: 0;
  }

  &__grid-scroll {
    overflow: auto;
    max-height: calc(100vh - 260px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
  }

  &__grid {
    border-collapse: collapse;
    width: 100%;

    th,
    td {
      border: 1px solid var(--p-line);
      vertical-align: top;
      padding: var(--p-1, 4px);
    }

    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--p-surface-2);
      color: var(--p-ink-2);
      font-size: var(--p-fs-meta, 12px);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: var(--p-2, 8px);
      text-align: center;
    }
  }

  &__grid-corner {
    width: 64px;
  }

  &__grid-level {
    width: 64px;
    background: var(--p-surface-2);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
    text-align: center;
    vertical-align: middle;
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
    min-height: 72px;
    min-width: 160px;
    border-radius: var(--p-r-sm, 8px);
    padding: var(--p-1, 4px);
    transition: background var(--p-dur-fast, 0.12s) var(--p-ease-standard);

    &.is-over {
      background: var(--p-primary-soft);
    }
  }

  &__cell-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__cell-code {
    font-family: var(--p-mono);
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
  }

  &__cell-body {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__box {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    background: var(--p-surface);
    padding: var(--p-1, 4px) var(--p-2, 8px);
    cursor: grab;
    color: var(--p-ink);

    &.is-dragging {
      opacity: 0.5;
    }

    &.is-over {
      border-color: var(--p-primary);
      background: var(--p-primary-soft);
    }

    &--wide {
      background: var(--p-surface-2);
    }
  }

  &__box-code {
    flex: 1 1 auto;
    font-family: var(--p-mono);
    font-size: var(--p-fs-body-sm, 13px);
    overflow-wrap: anywhere;
  }

  &__box-note {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  // Негабарит, лежащий прямо в ячейке.
  &__mini {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-2, 8px);
    border: 1px dashed var(--p-line-2, var(--p-line));
    border-radius: var(--p-r-sm, 8px);
    padding: var(--p-1, 4px) var(--p-2, 8px);
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-2);
    cursor: grab;

    &.is-dragging {
      opacity: 0.5;
    }
  }

  &__mini-name {
    overflow-wrap: anywhere;
  }

  &__mini-qty {
    font-variant-numeric: tabular-nums;
    flex: 0 0 auto;
  }

  // ─── Боксы без адреса ───
  &__boxes {
    flex: 1 1 240px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-3, 12px);
  }

  &__box-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
  }

  // ─── Диалоги ───
  &__form,
  &__box-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    padding-top: var(--p-2, 8px);
  }

  &__note {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__levels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--p-2, 8px);
  }

  &__box-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    border-bottom: 1px solid var(--p-line);
    padding-bottom: var(--p-2, 8px);
  }

  &__split {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__split-head {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__split-row {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
  }

  &__split-qty {
    width: 120px;
    flex: 0 0 auto;
  }

  &__split-place {
    flex: 1 1 auto;
  }

  &__split-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__split-total {
    font-variant-numeric: tabular-nums;
    color: var(--p-ink-2);

    &--bad {
      color: var(--p-neg);
      font-weight: 600;
    }
  }
}

@media (max-width: 768px) {
  .place {
    padding: var(--p-4, 16px);

    &__inbox {
      flex-basis: 100%;
    }
  }
}
</style>
