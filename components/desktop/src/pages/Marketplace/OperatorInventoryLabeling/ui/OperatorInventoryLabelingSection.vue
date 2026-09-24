<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useFirstLoad } from 'src/shared/lib/composables'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay'
import { CodeScanner, BARCODE_FORMATS } from 'src/widgets/Marketplace/CodeScanner'
import { ScannerDialog } from 'src/widgets/Marketplace/ScannerDialog'
import {
  BaseBadge,
  BaseButton,
  BaseCheckbox,
  BaseDialog,
  BaseInput,
  BaseMarkupTable,
  BaseSelect,
  CardListSkeleton,
  EmptyState,
} from 'src/shared/ui/base'
import type { BaseSelectOption } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import {
  HandoffTokenKind,
  decodeScannedCode,
  printBarcodeSheet,
  useMarketplaceRealtime,
} from 'src/shared/lib/marketplace'
import {
  buildPlacementOptions,
  containerLabel,
  createStorageGrid,
  moveContainer,
  nextSectionCode,
  parsePlacementValue,
  placementValueOf,
  renameStorageSection,
  resolveContainerByCode,
  retireStorageCells,
  useMarketplaceStorageStore,
  type MarketplaceContainerView,
  type MarketplaceStorageCellView,
} from 'src/entities/MarketplaceStorage'
import {
  assignInventoryPlacement,
  bindInventoryBarcode,
  clearInventoryLabel,
  listInventory,
  splitInventory,
  type MarketplaceInventoryItemView,
} from 'src/entities/MarketplaceInventory'
import { t } from 'src/shared/i18n';

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
 * Маркировка = наклеить заранее напечатанную этикетку со штрих-кодом и привязать
 * её к позиции сканером. Она независима от размещения и остаётся необязательной.
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
/** Скелетон — только на первой загрузке; дочитка обновляет молча. */
const firstLoad = useFirstLoad(loading)

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

/**
 * Подпись пустой колонки «Поступило». Различает три причины пустоты: на склад
 * ещё ничего не привозили, всё привезённое уже разложено, либо поиск ничего не
 * нашёл. Раньше пустой склад целиком подменял доску заглушкой, и оператор не
 * мог подготовить ячейки заранее.
 */
const inboxEmptyLabel = computed(() => {
  if (!boardItems.value.length) return t('marketplace.operatorInventoryLabeling.inboxEmptyNoItems')
  if (!placementEnabled.value) return t('marketplace.operatorInventoryLabeling.inboxEmptyNoMatch')
  return t('marketplace.operatorInventoryLabeling.inboxEmptyAllPlaced')
})

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
    FailAlert(e, t('marketplace.operatorInventoryLabeling.loadError'))
  } finally {
    loading.value = false
  }
}

/** Точечно поправить позицию в уже загруженном списке — для оптимизма ниже. */
function patchItem(id: string, patch: Partial<MarketplaceInventoryItemView>): void {
  const idx = items.value.findIndex((i) => i.id === id)
  const current = items.value[idx]
  if (idx < 0 || !current) return
  items.value[idx] = { ...current, ...patch }
}

// ─── Перекладка позиции: в бокс, в ячейку либо снятие с места ──
// Раскладка — это работа руками у стеллажа: бросил и потянулся за следующим.
// Поэтому карточка переезжает сразу, а сервер догоняет: иначе на каждое
// движение уходило бы два сетевых обхода (мутация плюс перезагрузка склада), и
// «Вынуть» ощущалось бы как зависание. Отказ сервера возвращает карточку на
// место и говорит почему — потерять изменение молча нельзя.
async function movePlacement(
  item: MarketplaceInventoryItemView,
  placement: { container_id?: string | null; cell_id?: string | null },
): Promise<void> {
  const nextContainer = placement.container_id ?? null
  const nextCell = placement.cell_id ?? null
  const before = { container_id: item.container_id, cell_id: item.cell_id }
  if ((before.container_id ?? null) === nextContainer && (before.cell_id ?? null) === nextCell) {
    return
  }

  patchItem(item.id, { container_id: nextContainer, cell_id: nextCell })
  try {
    await assignInventoryPlacement({
      inventory_id: item.id,
      container_id: nextContainer,
      cell_id: nextCell,
    })
  } catch (e) {
    patchItem(item.id, before)
    FailAlert(e, t('marketplace.operatorInventoryLabeling.moveError'))
  }
}

// ─── Снять штрих-код для переклейки (LABELED → RECEIVED) ──
async function removeLabel(item: MarketplaceInventoryItemView): Promise<void> {
  try {
    await clearInventoryLabel({ inventory_id: item.id })
    SuccessAlert(t('marketplace.operatorInventoryLabeling.labelRemovedMessage'))
    await load()
  } catch (e) {
    FailAlert(e, t('marketplace.operatorInventoryLabeling.labelRemoveError'))
  }
}

// ─── Drag & drop: перетаскиваем и позиции, и боксы ──
// Вид перетаскиваемого важен: позиция ложится в бокс или ячейку, бокс — только
// в ячейку. Без различения бокс «падал» бы внутрь другого бокса.
type DragKind = 'item' | 'container'
const dragKind = ref<DragKind | null>(null)
const dragId = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)

/**
 * Что тащим — компактной «пилюлей» вместо снимка всей карточки.
 *
 * Браузер по умолчанию тащит копию элемента целиком, а карточка позиции шире
 * бокса — она накрывает и цель, и её соседей, и бросок выходит вслепую. Ширину
 * снимка после старта не поменять, поэтому подменяем его сразу.
 */
function setCompactDragImage(event: DragEvent, title: string, note: string): void {
  if (!event.dataTransfer) return

  const ghost = document.createElement('div')
  ghost.className = 'place-drag-ghost'

  const name = document.createElement('span')
  name.className = 'place-drag-ghost__name'
  name.textContent = title
  ghost.appendChild(name)

  if (note) {
    const meta = document.createElement('span')
    meta.className = 'place-drag-ghost__meta'
    meta.textContent = note
    ghost.appendChild(meta)
  }

  document.body.appendChild(ghost)
  // Точка захвата — у левого края пилюли: так она уходит вправо-вниз от
  // курсора и не закрывает то, на что наводятся.
  event.dataTransfer.setDragImage(ghost, 12, 12)
  // Снимок браузер делает синхронно; сам элемент дальше не нужен.
  setTimeout(() => ghost.remove(), 0)
}

function onDragStart(
  kind: DragKind,
  id: string,
  event: DragEvent,
  title: string,
  note = '',
): void {
  dragKind.value = kind
  dragId.value = id
  // Системный курсор «переместить» вместо «копировать» — первый и самый
  // дешёвый признак того, что бросок вообще принимается.
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  setCompactDragImage(event, title, note)
}

// ─── Подсказка цели, едущая за курсором ───
// Подсветка самой цели помогает, только пока цель видно. Поэтому имя того, во
// что попадёшь, показывается там, куда точно смотрят, — над курсором, поверх
// всего остального.
//
// Координаты курсора НЕ реактивны, и это принципиально: `dragover` стреляет на
// каждое движение мыши, а перерисовка карты склада на каждый пиксель кладёт
// машину намертво. Позицию двигаем прямым стилем и не чаще кадра; реактивно
// меняется только сама цель — то есть в разы реже.
const dropHintEl = ref<HTMLElement | null>(null)
let pointerX = 0
let pointerY = 0
let pointerFrame = 0

function movePointerHint(): void {
  pointerFrame = 0
  const el = dropHintEl.value
  if (!el) return
  el.style.transform =
    `translate3d(${pointerX}px, ${pointerY}px, 0) translate(-50%, calc(-100% - 14px))`
}

function schedulePointerMove(): void {
  if (pointerFrame) return
  pointerFrame = requestAnimationFrame(movePointerHint)
}

const dragTargetLabel = computed(() => {
  const key = dragOverKey.value
  if (!key || !dragKind.value) return ''

  if (key.startsWith('box:')) {
    const box = storage.index.containerById.get(key.slice(4))
    return box ? t('marketplace.operatorInventoryLabeling.dropIntoBoxLabel', { code: box.code }) : ''
  }
  if (key.startsWith('cell:')) {
    const cell = storage.index.cellById.get(key.slice(5))
    return cell ? t('marketplace.operatorInventoryLabeling.dropIntoCellLabel', { code: cell.code }) : ''
  }
  if (key === '__inbox__') {
    return dragKind.value === 'container' ? t('marketplace.operatorInventoryLabeling.dropRemoveAddressLabel') : t('marketplace.operatorInventoryLabeling.dropRemoveLabel')
  }
  if (key === '__unplaced__') {
    return dragKind.value === 'container' ? t('marketplace.operatorInventoryLabeling.dropRemoveAddressLabel') : ''
  }
  return ''
})

// Плашка появляется по смене цели — до первого кадра она стояла бы в углу
// экрана и мигала оттуда к курсору.
watch(
  () => dragTargetLabel.value,
  (label) => {
    if (label) void nextTick(movePointerHint)
  },
)

function onDragOver(key: string, event: DragEvent): void {
  // Присваивание тем же значением Vue не будит, но проверка дешевле сравнения
  // строк внутри реактивной системы — а сюда заходят сотни раз за перетаскивание.
  if (dragOverKey.value !== key) dragOverKey.value = key
  pointerX = event.clientX
  pointerY = event.clientY
  schedulePointerMove()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

/**
 * Уход курсора с цели.
 *
 * `dragleave` срабатывает и когда курсор переходит на ВЛОЖЕННЫЙ элемент —
 * например с ячейки на стоящий в ней бокс. Без этой проверки подсветка гасла
 * ровно в тот момент, когда курсор наводился на бокс, и попадание становилось
 * невидимым: два бокса рядом, а какой из них примет — угадай.
 */
function onDragLeave(key: string, event: DragEvent): void {
  const from = event.currentTarget as HTMLElement | null
  const to = event.relatedTarget as Node | null
  if (from && to && from.contains(to)) return
  if (dragOverKey.value === key) dragOverKey.value = null
}
function onDragEnd(): void {
  dragKind.value = null
  dragId.value = null
  dragOverKey.value = null
  if (pointerFrame) {
    cancelAnimationFrame(pointerFrame)
    pointerFrame = 0
  }
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

/**
 * Бросок в «Боксы без адреса» снимает бокс с ячейки. Раньше эта полоса была
 * только витриной, и поставленный на адрес бокс оттуда было не достать —
 * перетаскивать его оказывалось некуда.
 */
function dropOnUnplaced(): void {
  const kind = dragKind.value
  const id = dragId.value
  onDragEnd()
  if (kind !== 'container' || !id) return
  void placeContainer(id, null)
}

async function placeContainer(containerId: string, cellId: string | null): Promise<void> {
  const before = storage.activeContainers.find((c) => c.id === containerId)?.cell_id ?? null
  if (before === cellId) return

  storage.patchContainer(containerId, { cell_id: cellId })
  try {
    const moved = await moveContainer({ container_id: containerId, cell_id: cellId })
    storage.applyContainer(moved)
  } catch (e) {
    storage.patchContainer(containerId, { cell_id: before })
    FailAlert(e, t('marketplace.operatorInventoryLabeling.relocateBoxError'))
  }
}

// ─── Варианты мест для выпадающих списков ──
// Порядок и подписи — общие для всех столов (entities/MarketplaceStorage),
// чтобы один и тот же бокс выглядел одинаково в раскладке, на складе участка
// и в окне закрывающей подписи.
const placementOptions = computed<BaseSelectOption[]>(() =>
  buildPlacementOptions({
    containers: storage.activeContainers,
    cells: storage.activeCells,
    index: storage.index,
    countOf: (id) => itemsInContainer(id).length,
    containersEnabled: containersEnabled.value,
    cellsEnabled: cellsEnabled.value,
  }),
)

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

// ─── Сканирование бокса: «что внутри» ──
// Кладовщик идёт вдоль стеллажей со сканером и пикает тару подряд, чтобы
// узнать содержимое, не открывая её. Это не приёмка и не выдача — только
// просмотр, поэтому скан просто открывает карточку бокса.
const boxScanOpen = ref(false)
const resolvingBox = ref(false)

async function onBoxScanned(raw: string): Promise<void> {
  if (resolvingBox.value) return
  const token = decodeScannedCode(raw, coopname.value)
  if (!token || token.kind !== HandoffTokenKind.Container || !token.container_code) {
    FailAlert(new Error(t('marketplace.error.notBoxQr')))
    return
  }
  resolvingBox.value = true
  try {
    const container = await resolveContainerByCode({ code: token.container_code })
    if (container.braname !== braname.value.trim()) {
      FailAlert(
        new Error(t('marketplace.error.foreignBoxLabeling', { code: container.code })),
      )
      return
    }
    // Бокс мог быть заведён только что и в списке ещё не значиться.
    storage.applyContainer(container)
    boxScanOpen.value = false
    openBox(container)
  } catch (e) {
    FailAlert(e, t('marketplace.operatorInventoryLabeling.boxNotFoundError'))
  } finally {
    resolvingBox.value = false
  }
}

// ─── Наращивание сетки прямо на карте склада ──
// Склад не проектируют в отдельном окне — его достраивают по мере того, как
// ставят стеллажи. Поэтому сетка растёт «плюсами» по краям карты: столбец
// вправо, ярус вверх или вниз. Отдельная форма с перечислением секций и
// диапазоном ярусов требовала держать раскладку склада в голове целиком.
const growing = ref(false)

const maxLevel = computed(() => (storage.levels.length ? Math.max(...storage.levels) : 0))
const minLevel = computed(() => (storage.levels.length ? Math.min(...storage.levels) : 0))

/** Ярус ниже первого возможен, только если нумерация не начинается с единицы. */
const canGrowDown = computed(() => minLevel.value > 1)

async function growGrid(
  sections: string[],
  levelFrom: number,
  levelTo: number,
): Promise<void> {
  if (growing.value || !sections.length || !braname.value.trim()) return
  growing.value = true
  try {
    const created = await createStorageGrid({
      braname: braname.value.trim(),
      sections,
      level_from: levelFrom,
      level_to: levelTo,
    })
    storage.applyCells(created)

    // Новая координата всегда пуста, а поиск и «только непустые» пустое
    // прячут — без сброса добавление выглядело бы как «ничего не произошло».
    onlyNonEmpty.value = false
    search.value = ''
  } catch (e) {
    FailAlert(e, t('marketplace.operatorInventoryLabeling.createCellsError'))
  } finally {
    growing.value = false
  }
}

// ─── Новая секция ──
// Имя спрашивается сразу, а не потом переименованием: секцию заводят зная,
// что это за стеллаж. Буква подставляется следующей свободной, но остаётся
// обычным полем — «Холодильник» вводится вместо неё, а не после неё.
const sectionDialogOpen = ref(false)
const newSectionName = ref('')

const newSectionValid = computed(() => {
  const name = newSectionName.value.trim()
  return name.length > 0 && !storage.sections.some((s) => s.toUpperCase() === name.toUpperCase())
})

function openSectionDialog(): void {
  newSectionName.value = nextSectionCode(storage.sections)
  sectionDialogOpen.value = true
}

async function submitSection(): Promise<void> {
  if (!newSectionValid.value) return
  const levels = storage.levels
  const from = levels.length ? minLevel.value : 1
  const to = levels.length ? maxLevel.value : 1
  const name = newSectionName.value.trim()
  sectionDialogOpen.value = false
  await growGrid([name], from, to)
}

/** Новый ярус сверху — во всех секциях сразу, иначе сетка станет дырявой. */
function addLevelUp(): void {
  const sections = storage.sections
  if (!sections.length) return
  const level = maxLevel.value + 1
  void growGrid(sections, level, level)
}

function addLevelDown(): void {
  if (!canGrowDown.value) return
  const level = minLevel.value - 1
  void growGrid(storage.sections, level, level)
}

/** Первая ячейка пустого склада — A-01, дальше сетка растёт плюсами. */
/**
 * Стартовая сетка: три секции по три яруса. Одна ячейка A-01, с которой
 * начинали раньше, выглядела на карте случайной точкой и всё равно требовала
 * достраивания вручную; девять ячеек сразу дают узнаваемый склад, который
 * правится по месту — секции переименовываются, лишнее снимается.
 */
function startGrid(): void {
  void growGrid(['A', 'B', 'C'], 1, 3)
}

// ─── Пересборка сетки: переименование секции и разбор координат ──
// Склад описывают по месту и задним числом: сначала «A», потом выясняется, что
// это холодильник; стеллаж убрали — ярус надо снять. Без этого сетку можно было
// только наращивать, и первая же опечатка оставалась на складе навсегда.
const editingSection = ref<string | null>(null)
const sectionDraft = ref('')

function startSectionRename(section: string): void {
  editingSection.value = section
  sectionDraft.value = section
}

function cancelSectionRename(): void {
  editingSection.value = null
  sectionDraft.value = ''
}

async function commitSectionRename(): Promise<void> {
  const from = editingSection.value
  const to = sectionDraft.value.trim()
  cancelSectionRename()
  if (!from || !to || from === to) return

  try {
    const renamed = await renameStorageSection({
      braname: braname.value.trim(),
      section: from,
      new_section: to,
    })
    storage.applyCells(renamed)
  } catch (e) {
    FailAlert(e, t('marketplace.operatorInventoryLabeling.renameSectionError'))
  }
}

async function retireSection(section: string): Promise<void> {
  try {
    const retired = await retireStorageCells({ braname: braname.value.trim(), section })
    storage.applyCells(retired)
    SuccessAlert(t('marketplace.operatorInventoryLabeling.sectionDeletedMessage', { section }))
  } catch (e) {
    FailAlert(e, t('marketplace.operatorInventoryLabeling.deleteSectionError'))
  }
}

async function retireLevel(level: number): Promise<void> {
  try {
    const retired = await retireStorageCells({ braname: braname.value.trim(), level })
    storage.applyCells(retired)
    SuccessAlert(t('marketplace.operatorInventoryLabeling.levelDeletedMessage', { level }))
  } catch (e) {
    FailAlert(e, t('marketplace.operatorInventoryLabeling.deleteLevelError'))
  }
}

// ─── Печать листа этикеток (для нарезки и наклейки) ──
// Сама печать живёт в shared/lib/marketplace: тот же лист печатается из окна
// оприходования при закрывающей подписи.
const printDialogOpen = ref(false)
const printCount = ref<number | null>(24)

function openPrintDialog(): void {
  printDialogOpen.value = true
}

function doPrint(): void {
  const n = Math.trunc(Number(printCount.value) || 0)
  if (n < 1) return
  printDialogOpen.value = false
  printBarcodeSheet(n)
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
    SuccessAlert(t('marketplace.operatorInventoryLabeling.labelBoundMessage', { code }))
    scanDialogOpen.value = false
    scanTarget.value = null
    await load()
  } catch (e) {
    FailAlert(e, t('marketplace.operatorInventoryLabeling.bindLabelError'))
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
    placement: placementValueOf(p),
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
        ...parsePlacementValue(r.placement),
      })),
    })
    SuccessAlert(
      splitRows.value.length > 1
        ? t('marketplace.operatorInventoryLabeling.splitDoneMessage', { count: splitRows.value.length })
        : t('marketplace.operatorInventoryLabeling.splitMergedMessage'),
    )
    splitDialogOpen.value = false
    await load()
  } catch (e) {
    FailAlert(e, t('marketplace.operatorInventoryLabeling.splitError'))
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
//- Секция стола «Склад моего КУ»: шапка участка и полоса разделов — на
//- странице-обёртке, здесь только содержимое раздела.
.place(role='region', :aria-label='$t("marketplace.operatorInventoryLabeling.ariaLabel")')
  EmptyState(
    v-if='branchStore.loaded && !branchStore.isOperator',
    :title='$t("marketplace.operatorInventoryLabeling.notOperatorTitle")',
    :body='$t("marketplace.operatorInventoryLabeling.notOperatorBody")'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    Teleport(to='#header-actions-host', defer)
      .place__head-actions
        BaseButton(
          v-if='containersEnabled',
          variant='secondary',
          size='sm',
          :loading='resolvingBox',
          @click='boxScanOpen = true'
        )
          template(#icon-left)
            q-icon(name='qr_code_scanner', size='16px')
          | {{ $t('marketplace.operatorInventoryLabeling.scanBoxButton') }}
        BaseButton(variant='secondary', size='sm', @click='openPrintDialog')
          template(#icon-left)
            q-icon(name='print', size='16px')
          | {{ $t('marketplace.operatorInventoryLabeling.printLabelsButton') }}

    PageHint(storage-key='mp:operator-labeling:banner-dismissed')
      template(v-if='cellsEnabled')
        | {{ $t('marketplace.operatorInventoryLabeling.hintCellsLine1') }}
        | {{ $t('marketplace.operatorInventoryLabeling.hintCellsLine2') }}
        | {{ $t('marketplace.operatorInventoryLabeling.hintCellsLine3') }}
        | {{ $t('marketplace.operatorInventoryLabeling.hintCellsLine4') }}
        | {{ $t('marketplace.operatorInventoryLabeling.hintCellsLine5') }}
      template(v-else-if='containersEnabled')
        | {{ $t('marketplace.operatorInventoryLabeling.hintContainersLine1') }}
        | {{ $t('marketplace.operatorInventoryLabeling.hintContainersLine2') }}
        | {{ $t('marketplace.operatorInventoryLabeling.hintContainersLine3') }}
      template(v-else)
        | {{ $t('marketplace.operatorInventoryLabeling.hintLabelsLine1') }}
        | {{ $t('marketplace.operatorInventoryLabeling.hintLabelsLine2') }}
        | {{ $t('marketplace.operatorInventoryLabeling.hintLabelsLine3') }}

    //- Канон загрузки: скелетон, а не спиннер.
    CardListSkeleton(v-if='firstLoad', :count='3')

    //- Пустой склад доску не прячет: ячейки и боксы заводят заранее, до первой
    //- поставки, — иначе оператору негде подготовить место (просьба владельца
    //- 2026-09-09). Пустота показывается внутри колонок, а не вместо карты.
    template(v-else)
      //- `field-flush` снимает у поля резерв строки под сообщение об ошибке:
      //- здесь ошибок не бывает, а резерв поднимал поле относительно
      //- переключателя рядом.
      .place__filters
        BaseInput.place__search.field-flush(
          v-model='search',
          type='search',
          :placeholder='$t("marketplace.operatorInventoryLabeling.searchPlaceholder")',
          clearable
        )
        BaseCheckbox(
          v-if='cellsEnabled',
          v-model='onlyNonEmpty',
          :label='$t("marketplace.operatorInventoryLabeling.onlyNonEmptyLabel")'
        )

      .place__layout
        //- ─────────────── Поступило: не размещённое имущество ───────────────
        .place__inbox(
          :class='{ "is-over": dragOverKey === "__inbox__", "place__inbox--solo": !placementEnabled }',
          @dragover.prevent='onDragOver("__inbox__", $event)',
          @dragleave='onDragLeave("__inbox__", $event)',
          @drop='dropOnInbox'
        )
          .place__col-head
            q-icon(name='inbox', size='18px')
            span.place__col-title {{ $t('marketplace.operatorInventoryLabeling.inboxColumnTitle') }}
            BaseBadge(variant='neutral') {{ inboxItems.length }}

          .place__col-body
            .place__empty-drop(v-if='!inboxItems.length')
              | {{ inboxEmptyLabel }}

            .place__card(
              v-for='item in inboxItems',
              :key='item.id',
              :draggable='placementEnabled',
              :class='{ "is-dragging": dragId === item.id }',
              @dragstart='onDragStart("item", item.id, $event, item.product_name_snapshot || $t("marketplace.operatorInventoryLabeling.productFallback"), $t(`marketplace.operatorInventoryLabeling.itemMetaText`, { quantity: item.quantity_per_label, orderer: ordererLabel(item) }))',
              @dragend='onDragEnd'
            )
              .place__card-top
                .place__card-info
                  .place__card-name {{ item.product_name_snapshot || $t('marketplace.operatorInventoryLabeling.productOfferFallback') }}
                  .place__card-meta {{ $t('marketplace.operatorInventoryLabeling.itemMetaText', { quantity: item.quantity_per_label, orderer: ordererLabel(item) }) }}
                .place__card-actions
                  BaseButton(
                    v-if='!item.barcode_value',
                    variant='ghost',
                    size='sm',
                    icon-only,
                    :aria-label='$t("marketplace.operatorInventoryLabeling.bindLabelHint")',
                    @click='openScan(item)'
                  )
                    template(#icon-left)
                      q-icon(name='qr_code_scanner', size='18px')
                      q-tooltip {{ $t('marketplace.operatorInventoryLabeling.bindLabelHint') }}
                  BaseButton(variant='ghost', size='sm', icon-only, :aria-label='$t("marketplace.operatorInventoryLabeling.actionsAriaLabel")')
                    template(#icon-left)
                      q-icon(name='more_vert', size='18px')
                      q-menu(anchor='bottom right', self='top right')
                        q-list(dense, style='min-width: 240px')
                          template(v-if='placementEnabled')
                            q-item-label(header) {{ $t('marketplace.operatorInventoryLabeling.placeMenuHeader') }}
                            q-item(
                              v-for='opt in placementOptions',
                              :key='opt.value',
                              clickable,
                              v-close-popup,
                              @click='movePlacement(item, parsePlacementValue(opt.value))'
                            )
                              q-item-section {{ opt.label }}
                              q-item-section(v-if='opt.caption', side)
                                q-item-label(caption) {{ opt.caption }}
                            q-separator
                          q-item(
                            v-if='canRedistribute(item)',
                            clickable,
                            v-close-popup,
                            @click='openSplit(item)'
                          )
                            q-item-section(avatar)
                              q-icon(name='call_split', size='18px')
                            q-item-section {{ $t('marketplace.operatorInventoryLabeling.splitByQuantityAction') }}
                          q-item(
                            v-if='item.barcode_value',
                            clickable,
                            v-close-popup,
                            @click='removeLabel(item)'
                          )
                            q-item-section(avatar)
                              q-icon(name='label_off', size='18px')
                            q-item-section {{ $t('marketplace.operatorInventoryLabeling.removeLabelAction') }}

              .place__card-badges
                BaseBadge(v-if='item.barcode_value', variant='pos') {{ $t('marketplace.operatorInventoryLabeling.labeledBadge') }}
                BaseBadge(v-else, variant='neutral') {{ $t('marketplace.operatorInventoryLabeling.unlabeledBadge') }}

              BarcodeDisplay(v-if='item.barcode_value', :code='item.barcode_value', size='sm')

        //- ─────────────── Координатная сетка склада ───────────────
        .place__grid-wrap(v-if='cellsEnabled')
          EmptyState(
            v-if='!storage.activeCells.length',
            :title='$t("marketplace.operatorInventoryLabeling.gridEmptyTitle")',
            :body='$t("marketplace.operatorInventoryLabeling.gridEmptyBody")'
          )
            template(#icon)
              q-icon(name='grid_view', size='48px')
            template(#action)
              BaseButton(variant='primary', size='sm', :loading='growing', @click='startGrid')
                template(#icon-left)
                  q-icon(name='grid_view', size='16px')
                | {{ $t('marketplace.operatorInventoryLabeling.createGridButton') }}

          EmptyState(
            v-else-if='!visibleSections.length',
            :title='$t("marketplace.operatorInventoryLabeling.searchEmptyTitle")',
            :body='$t("marketplace.operatorInventoryLabeling.searchEmptyBody")'
          )
            template(#icon)
              q-icon(name='search_off', size='48px')

          //- Сетка склада — не список строк, а карта помещения: столбцы это
          //- секции, строки ярусы, в каждой ячейке зона сброса со стопкой
          //- карточек. Сортировать и листать тут нечего, поэтому разметку
          //- пишем сами — но через канон-обёртку над q-markup-table, а не
          //- голым тегом.
          BaseMarkupTable.place__grid(
            v-else,
            separator='cell',
            dense,
            bordered,
            sticky-header,
            sticky-first-column,
            min-width='720px',
            max-height='calc(100vh - 260px)'
          )
            thead
              tr
                //- Угол таблицы читается по диагонали: над чертой — то, что идёт
                //- по горизонтали (секции), под чертой — то, что по вертикали
                //- (ярусы). Одна подпись «Ярус» заставляла гадать, чем же тогда
                //- подписаны столбцы.
                th.place__grid-corner
                  span.place__grid-corner-cols {{ $t('marketplace.operatorInventoryLabeling.sectionsHeader') }}
                  span.place__grid-corner-rows {{ $t('marketplace.operatorInventoryLabeling.levelsHeader') }}
                //- Заголовок секции правится на месте: имя стеллажа выясняется
                //- по ходу дела, и гонять оператора в отдельное окно ради
                //- слова «Холодильник» незачем.
                th(v-for='section in visibleSections', :key='section')
                  BaseInput(
                    v-if='editingSection === section',
                    v-model='sectionDraft',
                    flat,
                    autofocus,
                    :placeholder='$t("marketplace.operatorInventoryLabeling.sectionNamePlaceholder")',
                    @keydown.enter='commitSectionRename',
                    @keydown.esc='cancelSectionRename',
                    @blur='commitSectionRename'
                  )
                  .place__section(v-else)
                    span.place__section-name {{ section }}
                    BaseButton(variant='ghost', size='sm', icon-only, :aria-label='$t(`marketplace.operatorInventoryLabeling.sectionAriaLabel`, { section })')
                      template(#icon-left)
                        q-icon(name='more_vert', size='16px')
                        q-menu(anchor='bottom right', self='top right')
                          q-list(dense, style='min-width: 200px')
                            q-item(clickable, v-close-popup, @click='startSectionRename(section)')
                              q-item-section(avatar)
                                q-icon(name='edit', size='18px')
                              q-item-section {{ $t('marketplace.operatorInventoryLabeling.renameAction') }}
                            q-item(clickable, v-close-popup, @click='retireSection(section)')
                              q-item-section(avatar)
                                q-icon(name='delete_outline', size='18px')
                              q-item-section {{ $t('marketplace.operatorInventoryLabeling.deleteSectionAction') }}
                //- Плюс справа от последнего столбца — новая секция на всех
                //- ярусах сразу.
                th.place__grid-add
                  BaseButton.place__grow-btn(
                    variant='ghost',
                    size='sm',
                    :loading='growing',
                    :aria-label='$t("marketplace.operatorInventoryLabeling.addSectionAriaLabel")',
                    @click='openSectionDialog'
                  )
                    template(#icon-left)
                      q-icon(name='add', size='18px')
                      q-tooltip {{ $t('marketplace.operatorInventoryLabeling.addSectionButton') }}
            tbody
              //- Плюс яруса стоит в столбце ярусов — симметрично плюсу секции в
              //- строке заголовков. Ярусы растут вверх, поэтому и кнопка сверху.
              tr.place__grid-grow
                th.place__grid-level
                  BaseButton.place__grow-btn(
                    variant='ghost',
                    size='sm',
                    :loading='growing',
                    :aria-label='$t("marketplace.operatorInventoryLabeling.addLevelAriaLabel")',
                    @click='addLevelUp'
                  )
                    template(#icon-left)
                      q-icon(name='add', size='18px')
                      q-tooltip {{ $t('marketplace.operatorInventoryLabeling.addLevelTooltip', { level: maxLevel + 1 }) }}
                td(v-for='section in visibleSections', :key='section')
                td.place__grid-add

              tr(v-for='row in gridRows', :key='row.level')
                th.place__grid-level
                  .place__level
                    span {{ row.level }}
                    BaseButton(variant='ghost', size='sm', icon-only, :aria-label='$t(`marketplace.operatorInventoryLabeling.levelAriaLabel`, { level: row.level })')
                      template(#icon-left)
                        q-icon(name='more_vert', size='16px')
                        q-menu(anchor='bottom left', self='top left')
                          q-list(dense, style='min-width: 180px')
                            q-item(clickable, v-close-popup, @click='retireLevel(row.level)')
                              q-item-section(avatar)
                                q-icon(name='delete_outline', size='18px')
                              q-item-section {{ $t('marketplace.operatorInventoryLabeling.deleteLevelAction') }}
                td(v-for='slot in row.slots', :key='slot.section')
                    .place__cell(
                      v-if='slot.cell',
                      :class='{ "is-over": dragOverKey === `cell:${slot.cell.id}` }',
                      @dragover.prevent='onDragOver(`cell:${slot.cell.id}`, $event)',
                      @dragleave='onDragLeave(`cell:${slot.cell.id}`, $event)',
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
                          @dragstart.stop='onDragStart("container", box.id, $event, $t(`marketplace.operatorInventoryLabeling.boxLabel`, { code: box.code }), $t(`marketplace.operatorInventoryLabeling.boxPositionsCount`, { count: itemsInContainer(box.id).length }))',
                          @dragend='onDragEnd',
                          @dragover.prevent.stop='onDragOver(`box:${box.id}`, $event)',
                          @dragleave.stop='onDragLeave(`box:${box.id}`, $event)',
                          @drop.stop='dropOnContainer(box)',
                          @click='openBox(box)'
                        )
                          q-icon(
                            :name='dragOverKey === `box:${box.id}` ? "move_to_inbox" : "inbox"',
                            size='16px'
                          )
                          span.place__box-code {{ box.code }}
                          BaseBadge(variant='neutral') {{ itemsInContainer(box.id).length }}

                        .place__mini(
                          v-for='item in slot.loose',
                          :key='item.id',
                          draggable='true',
                          :class='{ "is-dragging": dragId === item.id }',
                          @dragstart='onDragStart("item", item.id, $event, item.product_name_snapshot || $t("marketplace.operatorInventoryLabeling.productFallback"), $t(`marketplace.operatorInventoryLabeling.itemQtyText`, { quantity: item.quantity_per_label }))',
                          @dragend='onDragEnd'
                        )
                          span.place__mini-name {{ item.product_name_snapshot || $t('marketplace.operatorInventoryLabeling.productFallback') }}
                          span.place__mini-qty {{ item.quantity_per_label }}
                td.place__grid-add

              //- Ярус ниже нижнего — только если нумерация начинается не с
              //- единицы: под первым ярусом склада ставить нечего. Так
              //- возвращают ярус, убранный по ошибке.
              tr.place__grid-grow(v-if='canGrowDown')
                th.place__grid-level
                  BaseButton.place__grow-btn(
                    variant='ghost',
                    size='sm',
                    :loading='growing',
                    :aria-label='$t("marketplace.operatorInventoryLabeling.restoreLowerLevelAriaLabel")',
                    @click='addLevelDown'
                  )
                    template(#icon-left)
                      q-icon(name='add', size='18px')
                      q-tooltip {{ $t('marketplace.operatorInventoryLabeling.addLevelTooltip', { level: minLevel - 1 }) }}
                td(v-for='section in visibleSections', :key='section')
                td.place__grid-add

        //- ─────────────── Боксы без адреса (или весь список без сетки) ───────
        //- Полоса принимает бокс из ячейки: бросок сюда снимает адрес.
        .place__boxes(
          v-if='containersEnabled',
          :class='{ "is-over": dragOverKey === "__unplaced__" }',
          @dragover.prevent='onDragOver("__unplaced__", $event)',
          @dragleave='onDragLeave("__unplaced__", $event)',
          @drop='dropOnUnplaced'
        )
          .place__col-head
            q-icon(name='inbox', size='18px')
            span.place__col-title {{ cellsEnabled ? $t('marketplace.operatorInventoryLabeling.unplacedBoxesTitleAddressed') : $t('marketplace.operatorInventoryLabeling.unplacedBoxesTitlePlain') }}
            BaseBadge(variant='neutral') {{ unplacedContainers.length }}

          .place__empty-drop(v-if='!unplacedContainers.length')
            | {{ cellsEnabled ? $t('marketplace.operatorInventoryLabeling.boxesAllPlacedMessage') : $t('marketplace.operatorInventoryLabeling.boxesNotCreatedMessage') }}

          .place__box-list
            .place__box.place__box--wide(
              v-for='box in unplacedContainers',
              :key='box.id',
              draggable='true',
              :class='{ "is-dragging": dragId === box.id, "is-over": dragOverKey === `box:${box.id}` }',
              @dragstart='onDragStart("container", box.id, $event, $t(`marketplace.operatorInventoryLabeling.boxLabel`, { code: box.code }), $t(`marketplace.operatorInventoryLabeling.boxPositionsCount`, { count: itemsInContainer(box.id).length }))',
              @dragend='onDragEnd',
              @dragover.prevent.stop='onDragOver(`box:${box.id}`, $event)',
              @dragleave.stop='onDragLeave(`box:${box.id}`, $event)',
              @drop.stop='dropOnContainer(box)',
              @click='openBox(box)'
            )
              q-icon(
                :name='dragOverKey === `box:${box.id}` ? "move_to_inbox" : "inbox"',
                size='16px'
              )
              span.place__box-code {{ box.code }}
              span.place__box-note(v-if='box.label') {{ box.label }}
              BaseBadge(variant='neutral') {{ itemsInContainer(box.id).length }}

  //- Куда попадёшь: имя цели едет за курсором, потому что саму цель закрывает
  //- то, что тащат. Плашка не ловит события — иначе перебивала бы dragover.
  .place__drop-hint(v-if='dragTargetLabel', ref='dropHintEl')
    q-icon(name='south_east', size='14px')
    span {{ dragTargetLabel }}

  //- ─────────────────────── Содержимое бокса ───────────────────────
  BaseDialog(v-model='boxDialogOpen', :title='boxTarget ? $t(`marketplace.operatorInventoryLabeling.boxLabel`, { code: boxTarget.code }) : $t("marketplace.operatorInventoryLabeling.boxDialogTitleFallback")', size='md')
    .place__box-dialog(v-if='boxTarget')
      .place__note {{ $t('marketplace.operatorInventoryLabeling.boxDialogSubtitle', { label: containerLabel(boxTarget, storage.index), count: boxItems.length }) }}

      EmptyState(v-if='!boxItems.length', :title='$t("marketplace.operatorInventoryLabeling.boxEmptyTitle")', :body='$t("marketplace.operatorInventoryLabeling.boxEmptyBody")')
        template(#icon)
          q-icon(name='inbox', size='40px')

      .place__box-row(v-for='item in boxItems', :key='item.id')
        .place__card-info
          .place__card-name {{ item.product_name_snapshot || $t('marketplace.operatorInventoryLabeling.productFallback') }}
          .place__card-meta {{ $t('marketplace.operatorInventoryLabeling.itemMetaText', { quantity: item.quantity_per_label, orderer: ordererLabel(item) }) }}
        BaseButton(variant='secondary', size='sm', @click='movePlacement(item, {})')
          template(#icon-left)
            q-icon(name='logout', size='16px')
          | {{ $t('marketplace.operatorInventoryLabeling.removeItemAction') }}
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='boxDialogOpen = false') {{ $t('common.action.close') }}

  //- ─────────────────────── Новая секция склада ───────────────────────
  BaseDialog(v-model='sectionDialogOpen', :title='$t("marketplace.operatorInventoryLabeling.newSectionDialogTitle")', size='sm')
    .place__form
      .place__note
        | {{ $t('marketplace.operatorInventoryLabeling.newSectionNoteLine1') }}
        | {{ $t('marketplace.operatorInventoryLabeling.newSectionNoteLine2') }}
      BaseInput(
        v-model='newSectionName',
        :label='$t("marketplace.operatorInventoryLabeling.newSectionNameLabel")',
        :placeholder='$t("marketplace.operatorInventoryLabeling.newSectionNamePlaceholder")',
        autofocus,
        @keydown.enter='submitSection'
      )
      .place__note(v-if='newSectionName.trim() && !newSectionValid')
        | {{ $t('marketplace.operatorInventoryLabeling.sectionExistsError') }}
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='growing', @click='sectionDialogOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(
        variant='primary',
        size='sm',
        :loading='growing',
        :disabled='!newSectionValid',
        @click='submitSection'
      ) {{ $t('marketplace.operatorInventoryLabeling.createSectionSubmit') }}

  //- ─────────────────────── Раскладка по количеству ───────────────────────
  BaseDialog(v-model='splitDialogOpen', :title='$t("marketplace.operatorInventoryLabeling.splitDialogTitle")', size='md')
    .place__split(v-if='splitTarget')
      .place__split-head
        | {{ $t('marketplace.operatorInventoryLabeling.splitHeadText', { productName: splitTarget.product_name_snapshot || $t('marketplace.operatorInventoryLabeling.productFallback'), totalQty: splitPoolTotal }) }}
      .place__note
        | {{ $t('marketplace.operatorInventoryLabeling.splitNoteLine1') }}
        | {{ $t('marketplace.operatorInventoryLabeling.splitNoteLine2') }}
      .place__split-row(v-for='(row, idx) in splitRows', :key='idx')
        BaseInput.place__split-qty(v-model.number='row.quantity', type='number', :label='$t("marketplace.operatorInventoryLabeling.splitQtyLabel")')
        BaseSelect.place__split-place(
          v-if='placementEnabled',
          v-model='row.placement',
          :options='placementOptions',
          :label='$t("marketplace.operatorInventoryLabeling.splitPlaceLabel")',
          searchable
        )
        BaseButton(
          variant='ghost',
          size='sm',
          icon-only,
          :disabled='splitRows.length <= 1',
          :aria-label='$t("marketplace.operatorInventoryLabeling.removeSplitRowAriaLabel")',
          @click='removeSplitRow(idx)'
        )
          template(#icon-left)
            q-icon(name='close', size='16px')
      .place__split-foot
        BaseButton(variant='ghost', size='sm', @click='addSplitRow')
          template(#icon-left)
            q-icon(name='add', size='16px')
          | {{ $t('marketplace.operatorInventoryLabeling.addSplitRowButton') }}
        span.place__split-total(:class='{ "place__split-total--bad": splitTotal !== splitPoolTotal }')
          | {{ $t('marketplace.operatorInventoryLabeling.splitSumText', { sum: splitTotal, total: splitPoolTotal }) }}
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='splitDialogOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', size='sm', :loading='splitting', :disabled='!splitValid', @click='applySplit') {{ $t('marketplace.operatorInventoryLabeling.splitSubmitButton') }}

  //- ─────────────────────── Печать штрих-кодов ───────────────────────
  BaseDialog(v-model='printDialogOpen', :title='$t("marketplace.operatorInventoryLabeling.printDialogTitle")', size='sm')
    .place__form
      .place__note
        | {{ $t('marketplace.operatorInventoryLabeling.printNoteLine1') }}
        | {{ $t('marketplace.operatorInventoryLabeling.printNoteLine2') }}
      BaseInput(
        v-model.number='printCount',
        type='number',
        :label='$t("marketplace.operatorInventoryLabeling.printCountLabel")',
        @keydown.enter='doPrint'
      )
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='printDialogOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', size='sm', :disabled='!printCount || printCount < 1', @click='doPrint') {{ $t('marketplace.operatorInventoryLabeling.printSubmitButton') }}

  //- ─────────────────────── Привязка штрих-кода ───────────────────────
  //- Считанный код привязывается сразу, отдельной кнопки «Привязать» не нужно.
  BaseDialog(v-model='scanDialogOpen', :title='$t("marketplace.operatorInventoryLabeling.bindLabelDialogTitle")', size='sm')
    .place__form
      .place__note(v-if='scanTarget')
        | {{ $t('marketplace.operatorInventoryLabeling.bindLabelNote', { productName: scanTarget.product_name_snapshot || $t('marketplace.operatorInventoryLabeling.productFallback') }) }}
      CodeScanner(
        :formats='BARCODE_FORMATS',
        :idle-caption='$t("marketplace.operatorInventoryLabeling.bindLabelIdleCaption")',
        :frame-hint='$t("marketplace.operatorInventoryLabeling.bindLabelFrameHint")',
        :start-label='$t("marketplace.operatorInventoryLabeling.bindLabelStartLabel")',
        :manual-label='$t("marketplace.operatorInventoryLabeling.bindLabelManualLabel")',
        manual-placeholder='4600000000000',
        :manual-button='$t("marketplace.operatorInventoryLabeling.bindLabelManualButton")',
        @scanned='submitScan'
      )
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='binding', @click='scanDialogOpen = false') {{ $t('common.action.close') }}

  //- ─────────────────────── Сканирование бокса ───────────────────────
  //- Не приёмка и не выдача: скан просто открывает карточку бокса, чтобы
  //- посмотреть содержимое, не вскрывая тару.
  ScannerDialog(
    v-model='boxScanOpen',
    :title='$t("marketplace.operatorInventoryLabeling.scanBoxDialogTitle")',
    :idle-caption='$t("marketplace.operatorInventoryLabeling.scanBoxIdleCaption")',
    :frame-hint='$t("marketplace.operatorInventoryLabeling.scanBoxFrameHint")',
    :manual-label='$t("marketplace.operatorInventoryLabeling.scanBoxManualLabel")',
    manual-placeholder='BX-0001',
    :manual-button='$t("marketplace.operatorInventoryLabeling.scanBoxManualButton")',
    @scanned='onBoxScanned'
  )
</template>

<style scoped lang="scss">
.place {
  // Внешние отступы держит страница-обёртка «Склад моего КУ» — секция живёт
  // внутри её полосы разделов и своих полей не добавляет.
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__head-actions {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  // Строка фильтров стоит на тех же колонках, что и раскладка под ней: поиск
  // ровно над «Поступило», переключатель — над картой. Поле шире колонки
  // читалось как сбой вёрстки — край поиска не совпадал ни с чем.
  &__filters {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__search {
    flex: 0 0 300px;
    max-width: 100%;
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
  // Пустое состояние карты стоит по центру свободной области и не жмётся к
  // краям: подсказка про адресный склад уже сказана баннером выше, здесь нужен
  // только повод завести сетку (просьба владельца 2026-09-09).
  &__grid-wrap :deep(.empty) {
    padding: var(--p-8, 48px) var(--p-6, 24px);
  }

  &__grid-wrap {
    flex: 1 1 480px;
    min-width: 0;
    max-width: 100%;
  }

  // Рамки, прокрутку и липкие заголовки держит BaseMarkupTable; здесь остаётся
  // только то, что специфично для карты склада.
  &__grid {
    border-radius: var(--p-r-md, 12px);

    :deep(table) {
      width: 100%;
    }

    th,
    td {
      vertical-align: top;
      padding: var(--p-1, 4px);
    }

    thead th {
      color: var(--p-ink-2);
      font-size: var(--p-fs-meta, 12px);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: var(--p-2, 8px);
      text-align: center;
    }
  }

  // Угол читается по диагонали: над чертой — подпись столбцов, под чертой —
  // подпись строк. Черта — отдельным слоем, а не фоном ячейки: фон у липкого
  // первого столбца свой и градиент затирает.
  &__grid-corner {
    width: 104px;
    position: relative;
    overflow: hidden;
    padding: var(--p-1, 4px) var(--p-2, 8px);
    font-size: var(--p-fs-caption, 11px);
    line-height: 1.35;

    &::after {
      content: '';
      position: absolute;
      left: -8%;
      right: -8%;
      top: 50%;
      height: 1px;
      background: var(--p-line);
      transform: rotate(-16deg);
      pointer-events: none;
    }
  }

  &__grid-corner-cols {
    display: block;
    text-align: right;
  }

  &__grid-corner-rows {
    display: block;
    text-align: left;
  }

  // Столбец и строки наращивания: служебные, поэтому узкие и приглушённые —
  // карта склада не должна выглядеть так, будто в ней есть лишняя секция.
  &__grid-add {
    width: 48px;
    text-align: center;
    vertical-align: middle;
    padding: 0;
  }

  &__grid-grow td {
    text-align: center;
  }

  // Ячейки с кнопками наращивания — без собственных отступов, кнопка занимает
  // их целиком. Отступы приходят от Quasar правилом для крайних колонок
  // плотной таблицы (`.q-table--dense .q-table th:first-child`), поэтому сброс
  // идёт от класса самой карты: иначе он проигрывает по весу и подложка кнопки
  // отстаёт от границ ячейки (жалоба 2026-09-09).
  &__grid :deep(.place__grid-grow th),
  &__grid :deep(.place__grid-grow td),
  &__grid :deep(th.place__grid-add),
  &__grid :deep(td.place__grid-add) {
    padding: 0;
  }

  // Строка наращивания низкая: это служебная полоса карты, а не ярус, и
  // растягивать её на высоту ячейки склада незачем — кнопка тогда висела в
  // пустоте, прижатая к верхнему краю.
  &__grid :deep(.place__grid-grow th),
  &__grid :deep(.place__grid-grow td) {
    height: 44px;
  }

  // Кнопка наращивания занимает ячейку целиком: попасть по иконке 18px в
  // ячейке шириной с палец не получалось, и добавление выглядело как
  // «нажал — ничего не произошло». Углы прямые — кнопка и есть ячейка карты,
  // скруглённая подложка внутри прямоугольной ячейки читалась как зазор.
  &__grow-btn {
    width: 100%;
    height: 100%;
    min-height: 44px;
    border-radius: 0;
  }

  &__grid-level {
    width: 72px;
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
    text-align: center;
    vertical-align: middle;
  }

  // Заголовок секции и номер яруса: подпись и её меню в одной строке. Кнопка
  // меню проявляется на наведении — в спокойном состоянии карта склада
  // остаётся картой, а не панелью управления.
  &__section,
  &__level {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--p-1, 4px);
  }

  &__section-name {
    overflow-wrap: anywhere;
  }

  &__section .q-btn,
  &__level .q-btn {
    opacity: 0;
    transition: opacity var(--p-dur-fast, 0.12s) var(--p-ease-standard);
  }

  th:hover &__section .q-btn,
  th:hover &__level .q-btn,
  &__section .q-btn:focus-visible,
  &__level .q-btn:focus-visible {
    opacity: 1;
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
    min-height: 72px;
    min-width: 160px;
    border-radius: var(--p-r-sm, 8px);
    padding: var(--p-1, 4px);

    // Ячейка подсвечивается иначе, чем бокс: пунктир вокруг всей площади
    // читается как «положу прямо сюда», а не «положу в эту тару».
    &.is-over {
      background: var(--p-primary-soft);
      outline: 2px dashed var(--p-primary-line);
      outline-offset: -2px;
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
    // Анимируем только transform: его браузер считает на композиторе. Тень и
    // фон переключаются мгновенно — их анимация означала бы перерисовку всей
    // карты склада на каждое движение курсора между боксами.
    transition: transform var(--p-dur-fast, 0.12s) var(--p-ease-standard);

    &.is-dragging {
      opacity: 0.5;
    }

    // Бокс под курсором приподнимается и обводится: два бокса стоят рядом, и
    // одной смены цвета фона мало — под перетаскиваемой карточкой её просто не
    // видно, и бросок получается наугад. Обводка рисуется `outline`, а не
    // рамкой: она не занимает места и не двигает соседей.
    &.is-over {
      background: var(--p-primary-soft);
      outline: 2px solid var(--p-primary);
      outline-offset: 1px;
      transform: scale(1.06);
      box-shadow: var(--p-shadow-pop);
      // Приподнятый бокс должен перекрывать соседний, а не подлезать под него.
      position: relative;
      z-index: 2;
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
  // Полоса во всю ширину под картой: боксы расставляют по ячейкам, а
  // безадресные — остаток, который не должен отъедать ширину у карты склада.
  &__boxes {
    flex: 1 1 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-3, 12px);
    transition: border-color var(--p-dur-fast, 0.12s) var(--p-ease-standard);

    // Полоса — зона сброса: сюда возвращают бокс, снятый с адреса.
    &.is-over {
      border-color: var(--p-primary);
    }
  }

  &__box-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
  }

  // Подсказка цели: над курсором, поверх всего, без перехвата событий.
  &__drop-hint {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 9000;
    // Двигается прямым трансформом из rAF — никаких переходов, иначе браузер
    // будет догонять курсор анимацией и отставать от него.
    will-change: transform;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    white-space: nowrap;
    padding: var(--p-1, 4px) var(--p-2, 8px);
    border-radius: var(--p-r-sm, 8px);
    background: var(--p-primary);
    color: var(--p-ink-on-primary);
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    box-shadow: var(--p-shadow-pop);
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

    &__inbox,
    &__search {
      flex-basis: 100%;
    }
  }
}
</style>

<style lang="scss">
/* Снимок перетаскивания браузер делает с элемента, лежащего в body, — scoped
   стили до него не достают, поэтому класс глобальный. Живёт этот элемент один
   кадр: ровно столько, сколько нужно браузеру, чтобы снять с него картинку. */
.place-drag-ghost {
  position: fixed;
  top: -1000px;
  left: -1000px;
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  max-width: 260px;
  padding: var(--p-1, 4px) var(--p-3, 12px);
  border: 1px solid var(--p-primary);
  border-radius: var(--p-r-lg, 16px);
  background: var(--p-surface);
  box-shadow: var(--p-shadow-pop);
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink);
  white-space: nowrap;
  overflow: hidden;
}

.place-drag-ghost__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}

.place-drag-ghost__meta {
  color: var(--p-ink-2);
  font-variant-numeric: tabular-nums;
}
</style>
