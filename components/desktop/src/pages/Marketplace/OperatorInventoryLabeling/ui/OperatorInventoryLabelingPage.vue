<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay'
import { CodeScanner, BARCODE_FORMATS } from 'src/widgets/Marketplace/CodeScanner'
import { BaseBadge, BaseButton, BaseDialog, BaseInput, CardListSkeleton, EmptyState } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace'
import {
  assignInventoryShelf,
  bindInventoryBarcode,
  clearInventoryLabel,
  fetchInventoryByBraname,
  splitInventory,
  type MarketplaceInventoryItemView,
} from '../api'

/**
 * Стол ПВЗ, «Склад участка». Имущество, принятое кооперативом (RECEIVED), лежит
 * на складе КУ — здесь оператор организует его физически как доску полок:
 *
 *   - колонка «Поступило» — принятое, ещё не разложенное;
 *   - колонки-полки — что лежит на каждой полке;
 *   - раскладка = перетащить карточку на полку (DnD) или через меню «⋮»;
 *   - «Разложить» дробит позицию по количеству на несколько полок;
 *   - маркировка = наклеить заранее напечатанный штрих-код и привязать его
 *     к позиции сканером (кнопка-штрихкод на карточке).
 *
 * «Печать этикеток» (в шапке) печатает лист произвольных штрих-кодов — оператор
 * режет и наклеивает их на имущество, затем сканирует, чтобы привязать к позиции.
 * Цель — при выдаче заказчику за секунды найти, на какой полке лежит заказ.
 */

const route = useRoute()
const store = useOperatorBranchStore()
const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')

const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(false)

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

// Полки-плейсхолдеры, созданные оператором, но пока пустые (нет позиций).
// Живут до перезагрузки — после reload остаются лишь полки с позициями.
const extraShelves = ref<string[]>([])

const shelfNames = computed(() => {
  const set = new Set<string>()
  for (const i of boardItems.value) if (i.shelf) set.add(i.shelf)
  for (const s of extraShelves.value) set.add(s)
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
})

interface BoardColumn {
  key: string
  title: string
  icon: string
  shelf: string | null
  items: MarketplaceInventoryItemView[]
}

const INBOX_KEY = '__inbox__'

const columns = computed<BoardColumn[]>(() => {
  const cols: BoardColumn[] = [
    {
      key: INBOX_KEY,
      title: 'Поступило',
      icon: 'inbox',
      shelf: null,
      items: boardItems.value.filter((i) => !i.shelf),
    },
  ]
  for (const name of shelfNames.value) {
    cols.push({
      key: name,
      title: name,
      icon: 'shelves',
      shelf: name,
      items: boardItems.value.filter((i) => i.shelf === name),
    })
  }
  return cols
})

// ── Перераскладка (split) по количеству: непромаркированный пул заказа ──
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
    items.value = await fetchInventoryByBraname(braname.value.trim())
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить склад участка')
  } finally {
    loading.value = false
  }
}

// ── Перекладка позиции на полку (и снятие — shelf=null) ──
async function moveToShelf(item: MarketplaceInventoryItemView, shelf: string | null): Promise<void> {
  const next = shelf?.trim() ? shelf.trim() : null
  if ((item.shelf ?? null) === next) return
  try {
    await assignInventoryShelf({ inventory_id: item.id, shelf: next })
    SuccessAlert(next ? `Переложено на полку «${next}»` : 'Снято с полки')
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось переложить позицию')
  }
}

// ── Снять штрих-код для переклейки (LABELED → RECEIVED) ──
async function removeLabel(item: MarketplaceInventoryItemView): Promise<void> {
  try {
    await clearInventoryLabel({ inventory_id: item.id })
    SuccessAlert('Штрих-код снят — позицию можно переклеить')
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось снять штрих-код')
  }
}

// ── Drag & drop карточек между колонками ──
const dragId = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)

function onDragStart(item: MarketplaceInventoryItemView): void {
  dragId.value = item.id
}
function onDragEnd(): void {
  dragId.value = null
  dragOverKey.value = null
}
function onDrop(col: BoardColumn): void {
  const item = items.value.find((i) => i.id === dragId.value)
  dragOverKey.value = null
  dragId.value = null
  if (item) void moveToShelf(item, col.shelf)
}

// ── Создание новой (пустой) полки ──
const newShelfOpen = ref(false)
const newShelfName = ref('')
function openNewShelf(): void {
  newShelfName.value = ''
  newShelfOpen.value = true
}
function createShelf(): void {
  const name = newShelfName.value.trim()
  if (!name) return
  if (!extraShelves.value.includes(name) && !shelfNames.value.includes(name)) {
    extraShelves.value.push(name)
  }
  newShelfOpen.value = false
}

// ── Генерация произвольного EAN-13 (12 цифр + контрольная) ──
function randomEAN13(): string {
  let base = ''
  for (let i = 0; i < 12; i++) base += Math.floor(Math.random() * 10).toString()
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3)
  const check = (10 - (sum % 10)) % 10
  return `${base}${check}`
}

// ── Печать листа произвольных штрих-кодов (для нарезки и наклейки) ──
const printDialogOpen = ref(false)
const printCount = ref<number | null>(24)

function openPrintDialog(): void {
  printDialogOpen.value = true
}

// SVG-полосы штрих-кода (тот же псевдо-рендер, что и в BarcodeDisplay) — строкой,
// чтобы печатать изолированный лист в скрытом iframe, а не весь UI приложения.
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
  const codes = Array.from({ length: n }, () => randomEAN13())
  printDialogOpen.value = false

  const labels = codes
    .map((code) => `<div class="lbl">${barcodeSvg(code)}<div class="code">${code}</div></div>`)
    .join('')
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Этикетки</title><style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: monospace; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .lbl { border: 1px solid #ddd; border-radius: 6px; padding: 6px; display: flex; flex-direction: column; align-items: center; break-inside: avoid; }
    .lbl svg { display: block; max-width: 100%; }
    .code { margin-top: 4px; letter-spacing: 2px; font-size: 13px; color: #111; }
  </style></head><body><div class="grid">${labels}</div></body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.srcdoc = html
  iframe.onload = () => {
    const win = iframe.contentWindow
    if (!win) return
    win.focus()
    win.print()
    win.addEventListener('afterprint', () => iframe.remove())
    window.setTimeout(() => iframe.remove(), 60000)
  }
  document.body.appendChild(iframe)
}

// ── Привязка штрих-кода к позиции ──
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

// ── Раскладка по количеству на несколько полок (split/merge/move) ──
const splitDialogOpen = ref(false)
const splitTarget = ref<MarketplaceInventoryItemView | null>(null)
const splitRows = ref<{ quantity: number | null; shelf: string }[]>([])

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
    shelf: p.shelf ?? '',
  }))
  if (splitRows.value.length === 1) splitRows.value.push({ quantity: null, shelf: '' })
  splitDialogOpen.value = true
}

function addSplitRow(): void {
  splitRows.value.push({ quantity: null, shelf: '' })
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
        shelf: r.shelf.trim() || null,
      })),
    })
    SuccessAlert(
      splitRows.value.length > 1
        ? `Заказ разложен на ${splitRows.value.length} полок(и)`
        : 'Заказ собран на одной полке',
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
    // Исполненное списание тоже опустошает полки склада.
    MarketplaceWriteoffStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() },
)

onMounted(async () => {
  await store.ensureLoaded(coopname.value)
  void load()
})
</script>

<template lang="pug">
q-page.place(role='region', aria-label='Склад участка')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Раскладка имущества доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    Teleport(to="#header-actions-host", defer)
      BaseButton(variant='secondary', size='sm', @click='openPrintDialog')
        template(#icon-left)
          q-icon(name='print', size='16px')
        | Печать этикеток

    PageHint.no-print(storage-key='mp:operator-labeling:banner-dismissed')
      | Разложите принятое имущество по полкам — чтобы при выдаче заказчику сразу
      | найти, где что лежит. Перетащите карточку на полку (или меню «⋮ → на полку»).
      | Штрих-код — по желанию, для поиска сканером.

    //- Канон загрузки: скелетон, а не спиннер.
    CardListSkeleton.no-print(v-if='loading && !items.length', :count='3')

    EmptyState.no-print(
      v-else-if='!boardItems.length',
      title='На складе пусто',
      body='Здесь появятся принятые позиции — после приёмки партии на столе «Приёмка партии».'
    )
      template(#icon)
        q-icon(name='inventory_2', size='48px')

    .place__board.no-print(v-else)
      .place__col(
        v-for='col in columns',
        :key='col.key',
        :class='{ "place__col--inbox": col.key === "__inbox__", "is-over": dragOverKey === col.key }',
        @dragover.prevent='dragOverKey = col.key',
        @dragleave='dragOverKey = (dragOverKey === col.key ? null : dragOverKey)',
        @drop='onDrop(col)'
      )
        .place__col-head
          q-icon(:name='col.icon', size='18px')
          span.place__col-title {{ col.title }}
          BaseBadge(variant='neutral') {{ col.items.length }}

        .place__col-body
          .place__empty-drop(v-if='!col.items.length')
            | {{ col.key === '__inbox__' ? 'Всё разложено' : 'Перетащите сюда' }}

          .place__card(
            v-for='item in col.items',
            :key='item.id',
            draggable='true',
            :class='{ "is-dragging": dragId === item.id }',
            @dragstart='onDragStart(item)',
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
                BaseButton.place__card-menu-btn(variant='ghost', size='sm', icon-only, aria-label='Действия')
                  template(#icon-left)
                    q-icon(name='more_vert', size='18px')
                    q-menu(anchor='bottom right', self='top right')
                      q-list(dense, style='min-width: 220px')
                        q-item-label(header) Переложить на полку
                        q-item(
                          v-for='name in shelfNames.filter((n) => n !== item.shelf)',
                          :key='name',
                          clickable,
                          v-close-popup,
                          @click='moveToShelf(item, name)'
                        )
                          q-item-section(avatar)
                            q-icon(name='shelves', size='18px')
                          q-item-section {{ name }}
                        q-item(clickable, v-close-popup, @click='openNewShelf')
                          q-item-section(avatar)
                            q-icon(name='add', size='18px')
                          q-item-section На новую полку…
                        q-item(
                          v-if='item.shelf',
                          clickable,
                          v-close-popup,
                          @click='moveToShelf(item, null)'
                        )
                          q-item-section(avatar)
                            q-icon(name='inbox', size='18px')
                          q-item-section Снять с полки
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

      //- Колонка-кнопка создания новой полки.
      .place__col.place__col--add
        BaseButton(variant='ghost', @click='openNewShelf')
          template(#icon-left)
            q-icon(name='add', size='18px')
          | Полка

  //- Новая полка.
  BaseDialog(v-model='newShelfOpen', title='Новая полка', size='sm')
    .place__new-shelf
      BaseInput(
        v-model='newShelfName',
        label='Название полки',
        placeholder='A-12',
        autofocus,
        @keydown.enter='createShelf'
      )
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='newShelfOpen = false') Отмена
      BaseButton(variant='primary', size='sm', :disabled='!newShelfName.trim()', @click='createShelf') Создать

  //- Раскладка по количеству.
  BaseDialog(v-model='splitDialogOpen', title='Разложить по полкам', size='md')
    .place__split(v-if='splitTarget')
      .place__split-head
        | {{ splitTarget.product_name_snapshot || 'Товар' }} — всего {{ splitPoolTotal }} ед.
      .place__split-note
        | Распределите весь заказ по полкам. Чтобы собрать обратно на одну полку —
        | удалите лишние строки; чтобы разложить иначе — измените количества и полки.
      .place__split-row(v-for='(row, idx) in splitRows', :key='idx')
        BaseInput.place__split-qty(
          v-model.number='row.quantity',
          type='number',
          label='Кол-во',
          dense
        )
        BaseInput.place__split-shelf(
          v-model='row.shelf',
          label='Полка',
          placeholder='A-12',
          dense
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
          | Ещё полка
        span.place__split-total(:class='{ "place__split-total--bad": splitTotal !== splitPoolTotal }')
          | Сумма: {{ splitTotal }} / {{ splitPoolTotal }}
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='splitDialogOpen = false') Отмена
      BaseButton(variant='primary', size='sm', :loading='splitting', :disabled='!splitValid', @click='applySplit') Разложить

  //- Печать листа произвольных штрих-кодов.
  BaseDialog(v-model='printDialogOpen', title='Печать этикеток', size='sm')
    .place__print-dialog
      .place__print-note
        | Сколько штрих-кодов напечатать? Распечатайте лист, разрежьте и наклейте
        | этикетки на имущество — затем привяжите их к позициям сканером.
      BaseInput(
        v-model.number='printCount',
        type='number',
        label='Количество этикеток',
        min='1',
        autofocus,
        @keydown.enter='doPrint'
      )
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='printDialogOpen = false') Отмена
      BaseButton(variant='primary', size='sm', :disabled='!printCount || printCount < 1', @click='doPrint') Печать

  //- Привязка штрих-кода: сканируем камерой телефона (или USB-сканер/ручной ввод
  //- в запасном поле) — единый виджет CodeScanner, как QR на приёмке/выдаче.
  //- Считанный код привязывается сразу, отдельной кнопки «Привязать» не нужно.
  BaseDialog(v-model='scanDialogOpen', title='Привязать штрих-код', size='sm')
    .place__scan
      .place__scan-note(v-if='scanTarget')
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

  // Доска полок — горизонтальный ряд колонок с прокруткой.
  &__board {
    display: flex;
    gap: var(--p-3, 12px);
    align-items: flex-start;
    overflow-x: auto;
    padding-bottom: var(--p-2, 8px);
  }

  &__col {
    flex: 0 0 280px;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface-2);
    padding: var(--p-3, 12px);
    max-height: calc(100vh - 220px);
    transition: border-color 0.12s ease, background 0.12s ease;

    &.is-over {
      border-color: var(--p-primary);
      background: var(--p-surface);
    }

    &--inbox {
      background: var(--p-surface);
    }

    &--add {
      border-style: dashed;
      background: transparent;
      align-items: stretch;
      justify-content: flex-start;
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
    background: var(--p-surface);
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

  &__print-dialog,
  &__scan {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    padding-top: var(--p-2, 8px);
  }

  &__print-note,
  &__scan-note {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__new-shelf {
    padding-top: var(--p-2, 8px);
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

  &__split-note {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__split-row {
    display: flex;
    align-items: flex-end;
    gap: var(--p-2, 8px);
  }

  &__split-qty {
    width: 110px;
  }

  &__split-shelf {
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

    &__col {
      flex-basis: 240px;
    }
  }
}
</style>
