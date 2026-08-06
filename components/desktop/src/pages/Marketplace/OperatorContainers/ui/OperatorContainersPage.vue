<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import {
  BaseBadge,
  BaseButton,
  BaseDialog,
  BaseInput,
  BaseSelect,
  EmptyState,
  TableSkeleton,
} from 'src/shared/ui/base'
import type { BaseSelectOption, TableSkeletonColumn } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import {
  containerLabel,
  createContainerType,
  createContainers,
  formatVolumeLiters,
  moveContainer,
  updateContainer,
  useMarketplaceStorageStore,
  volumeLitersOf,
  type MarketplaceContainerView,
} from 'src/entities/MarketplaceStorage'
import { listInventory, type MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory'
import {
  HandoffTokenKind,
  encodeHandoffToken,
  escapeHtml,
  printLabelSheet,
} from 'src/shared/lib/marketplace'

/**
 * Эпик 19, стол ПВЗ: «Боксы» кооперативного участка.
 *
 * Бокс — это тара со своим QR-кодом: имущество кладётся в бокс, а бокс стоит в
 * ячейке склада (или просто в углу — адрес не обязателен). Здесь председатель
 * участка заводит боксы партиями, печатает на них этикетки с QR, ставит их по
 * ячейкам и выводит из оборота пустые.
 *
 * Габариты задаёт ТИП бокса, а не отдельный бокс: тара закупается одинаковыми
 * партиями, а объём нужен агрегатом — чтобы в следующем эпике посчитать, сколько
 * машины займёт перевозка боксов между участками.
 */

const route = useRoute()
const branchStore = useOperatorBranchStore()
const storage = useMarketplaceStorageStore()

const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => branchStore.activeBraname ?? '')
const cellsEnabled = computed(() => branchStore.warehouseSettings.cells_enabled)

const inventory = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(true)

const activeTab = ref<'containers' | 'types'>('containers')
const tabs = computed<PageTab[]>(() => [
  { key: 'containers', label: 'Боксы', count: storage.activeContainers.length },
  { key: 'types', label: 'Типы боксов', count: storage.activeTypes.length },
])
function onSelectTab(tab: PageTab): void {
  activeTab.value = tab.key as typeof activeTab.value
}

// ─── Содержимое боксов считаем на фронте ───
// Бэкенд отдаёт боксы без счётчиков — и правильно делает: это производная от
// склада, которая протухла бы в тот же миг. Позиции склада участка уже здесь,
// поэтому группировка по `container_id` бесплатна.
const itemsByContainer = computed(() => {
  const map = new Map<string, MarketplaceInventoryItemView[]>()
  for (const item of inventory.value) {
    if (!item.container_id) continue
    const list = map.get(item.container_id)
    if (list) list.push(item)
    else map.set(item.container_id, [item])
  }
  return map
})

function itemsOf(container: MarketplaceContainerView): MarketplaceInventoryItemView[] {
  return itemsByContainer.value.get(container.id) ?? []
}

/** Что лежит в боксе — короткой строкой, чтобы не открывать бокс ради состава. */
function contentsOf(container: MarketplaceContainerView): string {
  const items = itemsOf(container)
  if (!items.length) return 'Пусто'
  const names = [...new Set(items.map((i) => i.product_name_snapshot || 'Товар'))]
  const head = names.slice(0, 2).join(', ')
  return names.length > 2 ? `${head} и ещё ${names.length - 2}` : head
}

function cellCodeOf(container: MarketplaceContainerView): string {
  if (!container.cell_id) return '—'
  return storage.index.cellById.get(container.cell_id)?.code ?? '—'
}

function typeNameOf(container: MarketplaceContainerView): string {
  return storage.typeById(container.container_type_id)?.name ?? '—'
}

function volumeOf(container: MarketplaceContainerView): string {
  const type = storage.typeById(container.container_type_id)
  return type ? formatVolumeLiters(type.volume_liters) : '—'
}

/** Суммарный объём боксов участка — задел под расчёт транспорта между КУ. */
const totalVolume = computed(() => {
  let sum = 0
  for (const c of storage.activeContainers) {
    const type = storage.typeById(c.container_type_id)
    if (type) sum += volumeLitersOf(type.volume_liters)
  }
  return `${sum.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} л`
})

const cellOptions = computed<BaseSelectOption[]>(() =>
  storage.activeCells.map((c) => ({
    value: c.id,
    label: c.label ? `${c.code} — ${c.label}` : c.code,
  })),
)

const typeOptions = computed<BaseSelectOption[]>(() =>
  storage.activeTypes.map((t) => ({
    value: t.id,
    label: `${t.name} — ${formatVolumeLiters(t.volume_liters)}`,
  })),
)

const containerSkeleton: TableSkeletonColumn[] = [
  { label: 'Код', class: 'col-code', cell: 'text' },
  { label: 'Тип', cell: 'text' },
  { label: 'Объём', class: 'col-volume', cell: 'text' },
  { label: 'Ячейка', class: 'col-cell', cell: 'text' },
  { label: 'Позиций', class: 'col-count', cell: 'text' },
  { label: 'Содержимое', cell: 'text' },
  { label: '', class: 'col-actions', cell: 'text' },
]

async function load(): Promise<void> {
  if (!braname.value.trim()) {
    inventory.value = []
    return
  }
  loading.value = true
  try {
    const [items] = await Promise.all([
      listInventory({ braname: braname.value.trim() }),
      storage.load(braname.value.trim(), { containers: true, cells: cellsEnabled.value }),
    ])
    inventory.value = items
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить боксы участка')
  } finally {
    loading.value = false
  }
}

watch(braname, () => void load())

onMounted(async () => {
  await branchStore.ensureLoaded(coopname.value)
  void load()
})

// ─── Печать QR-этикеток ───
// QR рисуется настоящей библиотекой `qrcode`, а не псевдо-рендером: этикетку
// должен прочитать сканер в окне закрывающей подписи. Кодируем тот же токен
// передачи, что и остальные QR стола ПВЗ, — вид `container`.
async function labelHtml(container: MarketplaceContainerView): Promise<string> {
  const token = encodeHandoffToken({
    kind: HandoffTokenKind.Container,
    coopname: coopname.value,
    account: '',
    container_code: container.code,
  })
  const dataUrl = await QRCode.toDataURL(token, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: 'M',
  })
  const note = container.label ? `<div class="note">${escapeHtml(container.label)}</div>` : ''
  return `<img src="${dataUrl}" alt="QR ${escapeHtml(container.code)}"/><div class="code">${escapeHtml(
    container.code,
  )}</div>${note}`
}

const printing = ref(false)

async function printLabels(list: MarketplaceContainerView[]): Promise<void> {
  if (!list.length || printing.value) return
  printing.value = true
  try {
    const labels = await Promise.all(list.map(labelHtml))
    printLabelSheet({ title: 'QR-этикетки боксов', labels })
  } catch (e) {
    FailAlert(e, 'Не удалось построить QR-этикетки')
  } finally {
    printing.value = false
  }
}

// ─── Завести партию боксов ───
const batchOpen = ref(false)
const batchTypeId = ref<string | null>(null)
const batchCount = ref<number | null>(10)
const batchLabel = ref('')
const batchSaving = ref(false)

const batchValid = computed(
  () => !!batchTypeId.value && Number(batchCount.value) >= 1 && Number(batchCount.value) <= 200,
)

function openBatch(): void {
  batchTypeId.value = storage.activeTypes[0]?.id ?? null
  batchCount.value = 10
  batchLabel.value = ''
  batchOpen.value = true
}

async function submitBatch(): Promise<void> {
  if (!batchValid.value || !batchTypeId.value) return
  batchSaving.value = true
  try {
    const created = await createContainers({
      braname: braname.value.trim(),
      container_type_id: batchTypeId.value,
      count: Math.trunc(Number(batchCount.value)),
      label: batchLabel.value.trim() || null,
    })
    SuccessAlert(
      created.length === 1
        ? `Заведён бокс ${created[0]?.code}`
        : `Заведено боксов: ${created.length} (${created[0]?.code}…${created[created.length - 1]?.code})`,
    )
    batchOpen.value = false
    await load()
    // Печать сразу после заведения — этикетки нужны на новые боксы, а не когда-то.
    await printLabels(created)
  } catch (e) {
    FailAlert(e, 'Не удалось завести боксы')
  } finally {
    batchSaving.value = false
  }
}

// ─── Завести тип боксов ───
const typeOpen = ref(false)
const typeSaving = ref(false)
interface ContainerTypeForm {
  name: string
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  max_weight_kg: string
}

function emptyTypeForm(): ContainerTypeForm {
  return { name: '', length_mm: null, width_mm: null, height_mm: null, max_weight_kg: '' }
}

const typeForm = ref<ContainerTypeForm>(emptyTypeForm())

const typeValid = computed(
  () =>
    typeForm.value.name.trim().length > 0 &&
    Number(typeForm.value.length_mm) > 0 &&
    Number(typeForm.value.width_mm) > 0 &&
    Number(typeForm.value.height_mm) > 0,
)

/** Объём считает бэкенд, но оператор должен видеть его до сохранения. */
const typeVolumePreview = computed(() => {
  const l = Number(typeForm.value.length_mm)
  const w = Number(typeForm.value.width_mm)
  const h = Number(typeForm.value.height_mm)
  if (!(l > 0 && w > 0 && h > 0)) return ''
  const liters = (l * w * h) / 1_000_000
  return `${liters.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} л`
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
      length_mm: Math.trunc(Number(typeForm.value.length_mm)),
      width_mm: Math.trunc(Number(typeForm.value.width_mm)),
      height_mm: Math.trunc(Number(typeForm.value.height_mm)),
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

// ─── Поставить бокс в ячейку / снять с адреса ───
const placeOpen = ref(false)
const placeTarget = ref<MarketplaceContainerView | null>(null)
const placeCellId = ref<string | null>(null)
const placeSaving = ref(false)

function openPlace(container: MarketplaceContainerView): void {
  placeTarget.value = container
  placeCellId.value = container.cell_id
  placeOpen.value = true
}

async function submitPlace(): Promise<void> {
  const target = placeTarget.value
  if (!target) return
  placeSaving.value = true
  try {
    await moveContainer({ container_id: target.id, cell_id: placeCellId.value })
    SuccessAlert(
      placeCellId.value
        ? `Бокс ${target.code} поставлен в ячейку`
        : `Бокс ${target.code} снят с адреса`,
    )
    placeOpen.value = false
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось переставить бокс')
  } finally {
    placeSaving.value = false
  }
}

// ─── Вывод из оборота ───
const retiringId = ref<string | null>(null)

async function retire(container: MarketplaceContainerView): Promise<void> {
  retiringId.value = container.id
  try {
    await updateContainer({ container_id: container.id, is_active: false })
    SuccessAlert(`Бокс ${container.code} выведен из оборота`)
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось вывести бокс из оборота')
  } finally {
    retiringId.value = null
  }
}
</script>

<template lang="pug">
q-page.containers(role='region', aria-label='Боксы участка')
  OperatorBranchBar

  EmptyState(
    v-if='branchStore.loaded && !branchStore.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Боксы участка доступны председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    Teleport(to='#header-actions-host', defer)
      .containers__head-actions
        BaseButton(
          v-if='activeTab === "containers"',
          variant='secondary',
          size='sm',
          :loading='printing',
          :disabled='!storage.activeContainers.length',
          @click='printLabels(storage.activeContainers)'
        )
          template(#icon-left)
            q-icon(name='print', size='16px')
          | Печать всех QR
        BaseButton(
          v-if='activeTab === "containers"',
          variant='primary',
          size='sm',
          :disabled='!storage.activeTypes.length',
          @click='openBatch'
        )
          template(#icon-left)
            q-icon(name='add', size='16px')
          | Завести боксы
        BaseButton(v-else, variant='primary', size='sm', @click='openType')
          template(#icon-left)
            q-icon(name='add', size='16px')
          | Тип боксов

    PageHint(storage-key='mp:operator-containers:banner-dismissed')
      | Бокс — тара со своим QR-кодом: имущество кладётся в бокс, а бокс стоит в
      | ячейке склада или просто в углу — адрес не обязателен. Заведите боксы
      | партией, наклейте на них напечатанные QR — и при закрывающей подписи
      | приёмки достаточно будет отсканировать бокс, чтобы принятое легло на место.

    PageTabs(:tabs='tabs', :active-key='activeTab', @select='onSelectTab')

    //- ─────────────────────────── Боксы ───────────────────────────
    template(v-if='activeTab === "containers"')
      TableSkeleton(
        v-if='loading && !storage.containers.length',
        :columns='containerSkeleton',
        :rows='6',
        min-width='980px'
      )

      EmptyState(
        v-else-if='!storage.activeTypes.length',
        title='Сначала заведите тип боксов',
        body='Габариты и объём задаёт тип, а не отдельный бокс: тару закупают одинаковыми партиями, а объём нужен агрегатом для расчёта перевозки.'
      )
        template(#icon)
          q-icon(name='straighten', size='48px')

      .table-wrap(v-else-if='storage.activeContainers.length')
        .table-scroll
          table.table
            thead
              tr
                th.col-code Код
                th.col-type Тип
                th.col-volume Объём
                th.col-cell(v-if='cellsEnabled') Ячейка
                th.col-count Позиций
                th.col-contents Содержимое
                th.col-actions
            tbody
              tr(v-for='c in storage.activeContainers', :key='c.id')
                td.col-code
                  span.containers__code {{ c.code }}
                  .containers__sub(v-if='c.label') {{ c.label }}
                td.col-type {{ typeNameOf(c) }}
                td.col-volume {{ volumeOf(c) }}
                td.col-cell(v-if='cellsEnabled')
                  span(v-if='c.cell_id') {{ cellCodeOf(c) }}
                  BaseBadge(v-else, variant='neutral') Без адреса
                td.col-count {{ itemsOf(c).length }}
                td.col-contents.containers__contents {{ contentsOf(c) }}
                td.col-actions
                  .containers__row-actions
                    BaseButton(
                      variant='ghost',
                      size='sm',
                      icon-only,
                      aria-label='Печать QR-этикетки',
                      :loading='printing',
                      @click='printLabels([c])'
                    )
                      template(#icon-left)
                        q-icon(name='print', size='18px')
                        q-tooltip Печать QR-этикетки
                    BaseButton(
                      variant='ghost',
                      size='sm',
                      icon-only,
                      aria-label='Действия с боксом'
                    )
                      template(#icon-left)
                        q-icon(name='more_vert', size='18px')
                        q-menu(anchor='bottom right', self='top right')
                          q-list(dense, style='min-width: 220px')
                            q-item(
                              v-if='cellsEnabled',
                              clickable,
                              v-close-popup,
                              @click='openPlace(c)'
                            )
                              q-item-section(avatar)
                                q-icon(name='grid_view', size='18px')
                              q-item-section {{ c.cell_id ? 'Переставить в ячейку…' : 'Поставить в ячейку…' }}
                            q-item(
                              v-if='!itemsOf(c).length',
                              clickable,
                              v-close-popup,
                              @click='retire(c)'
                            )
                              q-item-section(avatar)
                                q-icon(name='archive', size='18px')
                              q-item-section Вывести из оборота
                            q-item(v-else, disable)
                              q-item-section(avatar)
                                q-icon(name='info', size='18px')
                              q-item-section Непустой бокс не выводится

        .table-foot
          span Боксов: {{ storage.activeContainers.length }} · суммарный объём {{ totalVolume }}

      EmptyState(
        v-else,
        title='Боксов пока нет',
        body='Заведите партию боксов — коды и QR-этикетки система выдаст сама.'
      )
        template(#icon)
          q-icon(name='inbox', size='48px')

    //- ────────────────────────── Типы боксов ──────────────────────
    template(v-else)
      .table-wrap(v-if='storage.activeTypes.length')
        .table-scroll
          table.table.containers__types
            thead
              tr
                th Название
                th.col-dims Габариты, мм
                th.col-volume Объём
                th.col-weight Макс. вес
                th.col-count Боксов
            tbody
              tr(v-for='t in storage.activeTypes', :key='t.id')
                td {{ t.name }}
                td.col-dims {{ t.length_mm }} × {{ t.width_mm }} × {{ t.height_mm }}
                td.col-volume {{ formatVolumeLiters(t.volume_liters) }}
                td.col-weight {{ t.max_weight_kg ? `${t.max_weight_kg} кг` : '—' }}
                td.col-count {{ storage.activeContainers.filter((c) => c.container_type_id === t.id).length }}

      EmptyState(
        v-else,
        title='Типы боксов не заведены',
        body='Тип задаёт габариты и объём тары. Заведите его первым — дальше боксы создаются партиями одного типа.'
      )
        template(#icon)
          q-icon(name='straighten', size='48px')

  //- ─────────────────────── Диалог: партия боксов ───────────────────────
  BaseDialog(v-model='batchOpen', title='Завести боксы', size='sm')
    .containers__form
      .containers__note
        | Коды выдаются подряд (BX-0001, BX-0002 …). Сразу после заведения
        | откроется лист QR-этикеток на печать.
      BaseSelect(v-model='batchTypeId', :options='typeOptions', label='Тип боксов')
      BaseInput(v-model.number='batchCount', type='number', label='Сколько завести')
      BaseInput(v-model='batchLabel', label='Подпись партии', placeholder='Например: молочка')
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='batchSaving', @click='batchOpen = false') Отмена
      BaseButton(variant='primary', size='sm', :loading='batchSaving', :disabled='!batchValid', @click='submitBatch') Завести

  //- ─────────────────────── Диалог: тип боксов ───────────────────────
  BaseDialog(v-model='typeOpen', title='Тип боксов', size='sm')
    .containers__form
      .containers__note
        | Габариты нужны, чтобы посчитать объём тары: по нему в дальнейшем
        | определяется, сколько места займёт перевозка боксов между участками.
      BaseInput(v-model='typeForm.name', label='Название', placeholder='Ящик 600×400×300')
      .containers__dims
        BaseInput(v-model.number='typeForm.length_mm', type='number', label='Длина, мм')
        BaseInput(v-model.number='typeForm.width_mm', type='number', label='Ширина, мм')
        BaseInput(v-model.number='typeForm.height_mm', type='number', label='Высота, мм')
      BaseInput(v-model='typeForm.max_weight_kg', label='Предельный вес, кг', placeholder='Необязательно')
      .containers__note(v-if='typeVolumePreview') Полезный объём: {{ typeVolumePreview }}
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='typeSaving', @click='typeOpen = false') Отмена
      BaseButton(variant='primary', size='sm', :loading='typeSaving', :disabled='!typeValid', @click='submitType') Завести

  //- ─────────────────────── Диалог: поставить в ячейку ───────────────────────
  BaseDialog(v-model='placeOpen', title='Место бокса', size='sm')
    .containers__form(v-if='placeTarget')
      .containers__note
        | Бокс {{ containerLabel(placeTarget, storage.index) }}. Адрес не обязателен —
        | бокс может просто стоять на участке без ячейки.
      BaseSelect(v-model='placeCellId', :options='cellOptions', label='Ячейка')
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='placeSaving', @click='placeOpen = false') Отмена
      BaseButton(
        variant='secondary',
        size='sm',
        :disabled='placeSaving || !placeCellId',
        @click='placeCellId = null'
      ) Снять адрес
      BaseButton(variant='primary', size='sm', :loading='placeSaving', @click='submitPlace') Сохранить
</template>

<style scoped lang="scss">
.containers {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__head-actions {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
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

  &__contents {
    color: var(--p-ink-2);
    overflow-wrap: anywhere;
  }

  &__row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--p-1, 4px);
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    padding-top: var(--p-2, 8px);
  }

  &__note {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__dims {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--p-2, 8px);
  }
}

.table-scroll {
  overflow-x: auto;
}
// Сумма ширин колонок = min-width: колонки не схлопываются, а на узком экране
// включается горизонтальная прокрутка вместо наезжающих друг на друга ячеек.
.table {
  table-layout: fixed;
  min-width: 980px;

  &.containers__types {
    min-width: 720px;
  }
}

.col-code {
  width: 160px;
}
.col-type {
  width: 200px;
}
.col-dims {
  width: 200px;
  white-space: nowrap;
}
.col-volume {
  width: 110px;
  white-space: nowrap;
}
.col-weight {
  width: 120px;
  white-space: nowrap;
}
.col-cell {
  width: 140px;
}
.col-count {
  width: 100px;
  text-align: right;
}
.col-contents {
  width: 260px;
}
.col-actions {
  width: 96px;
}

@media (max-width: 768px) {
  .containers {
    padding: var(--p-4, 16px);

    &__dims {
      grid-template-columns: 1fr;
    }
  }
}
</style>
