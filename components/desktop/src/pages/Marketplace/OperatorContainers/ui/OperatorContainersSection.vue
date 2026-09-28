<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useLiveReload } from 'src/shared/lib/realtime'
import { useFirstLoad } from 'src/shared/lib/composables'
import QRCode from 'qrcode'
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
import { ContainerContentsDrawer } from 'src/widgets/Marketplace/ContainerContentsDrawer'
import { useOperatorBranchStore } from 'src/entities/OperatorBranch'
import {
  containerLabel,
  createContainers,
  formatVolumeM3,
  moveContainer,
  updateContainer,
  useMarketplaceStorageStore,
  volumeM3Of,
  type MarketplaceContainerView,
} from 'src/entities/MarketplaceStorage'
import {
  isOnWarehouse,
  listInventory,
  type MarketplaceInventoryItemView,
} from 'src/entities/MarketplaceInventory'
import {
  HandoffTokenKind,
  encodeHandoffToken,
  escapeHtml,
  printLabelSheet,
  marketLiveTables,
} from 'src/shared/lib/marketplace'
import { t as i18nT } from 'src/shared/i18n';

/**
 * Эпик 19, стол ПВЗ: «Боксы» кооперативного участка.
 *
 * Бокс — это тара со своим QR-кодом: имущество кладётся в бокс, а бокс стоит в
 * ячейке склада (или просто в углу — адрес не обязателен). Здесь председатель
 * участка заводит боксы партиями, печатает на них этикетки с QR, ставит их по
 * ячейкам и выводит из оборота пустые.
 *
 * Габариты задаёт ТИП бокса, а не отдельный бокс: тара закупается одинаковыми
 * партиями, а объём нужен агрегатом — чтобы посчитать, сколько машины займёт
 * перевозка боксов между участками. Сами типы — общий справочник кооператива и
 * живут на столе администратора («Боксы кооператива» → «Типы боксов»): участок
 * выбирает готовый тип, а не заводит свой (решение владельца 14.09.2026).
 */

const emit = defineEmits<{
  (e: 'counts', value: { containers: number }): void
}>()

const route = useRoute()
const branchStore = useOperatorBranchStore()
const storage = useMarketplaceStorageStore()

const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => branchStore.activeBraname ?? '')
const cellsEnabled = computed(() => branchStore.warehouseSettings.cells_enabled)

const inventory = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(true)
/** Пустое состояние и каркас — по первой загрузке; дочитка обновляет молча. */
const firstLoad = useFirstLoad(loading)

/**
 * Отмеченные боксы — для перепечатки этикеток пачкой. Печать всех годится
 * ровно один раз, при заведении партии; дальше переклеивают отдельные боксы —
 * ободрался QR, бокс уехал на другой участок, — и гнать ради этого весь лист
 * не годится.
 */
const selectedContainers = ref<MarketplaceContainerView[]>([])

// Счётчик боксов считает эта секция, а показывает его полоса разделов на
// странице-обёртке.
watch(
  () => storage.activeContainers.length,
  (containers) => emit('counts', { containers }),
  { immediate: true },
)

// ─── Содержимое боксов считаем на фронте ───
// Бэкенд отдаёт боксы без счётчиков — и правильно делает: это производная от
// склада, которая протухла бы в тот же миг. Позиции склада участка уже здесь,
// поэтому группировка по `container_id` бесплатна.
const itemsByContainer = computed(() => {
  const map = new Map<string, MarketplaceInventoryItemView[]>()
  for (const item of inventory.value) {
    // Выданное и списанное бокс уже покинуло — занятым он от этого не считается.
    if (!item.container_id || !isOnWarehouse(item.status)) continue
    const list = map.get(item.container_id)
    if (list) list.push(item)
    else map.set(item.container_id, [item])
  }
  return map
})

function itemsOf(container: MarketplaceContainerView): MarketplaceInventoryItemView[] {
  return itemsByContainer.value.get(container.id) ?? []
}

// ─── Содержимое бокса ───
// Колонка отвечает «сколько позиций», а оператору нужно «что именно лежит»:
// строка открывает боковую панель с составом. Позиции склада участка уже
// загружены вместе с боксами, поэтому панель ничего не дозапрашивает.
const openedContainer = ref<MarketplaceContainerView | null>(null)
const contentsOpen = ref(false)

function openContainer(container: MarketplaceContainerView): void {
  openedContainer.value = container
  contentsOpen.value = true
}

const openedItems = computed(() =>
  openedContainer.value ? itemsOf(openedContainer.value) : [],
)

/** Участок, где стоит бокс: наименование и адрес отдельной строкой под ним. */
const branchName = computed(() => branchStore.activeBranch?.name ?? '')
const branchAddress = computed(() => branchStore.activeBranch?.address ?? '')

/** Что лежит в боксе — короткой строкой, чтобы не открывать бокс ради состава. */
function contentsOf(container: MarketplaceContainerView): string {
  const items = itemsOf(container)
  if (!items.length) return i18nT('marketplace.operatorContainers.contentsEmpty')
  const names = [...new Set(items.map((i) => i.product_name_snapshot || i18nT('marketplace.operatorContainers.productFallback')))]
  const head = names.slice(0, 2).join(', ')
  return names.length > 2 ? i18nT('marketplace.operatorContainers.contentsMore', { names: head, extraCount: names.length - 2 }) : head
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
  return type ? formatVolumeM3(type.volume_m3) : '—'
}

/** Суммарный объём боксов участка — задел под расчёт транспорта между КУ. */
const totalVolume = computed(() => {
  let sum = 0
  for (const c of storage.activeContainers) {
    const type = storage.typeById(c.container_type_id)
    if (type) sum += volumeM3Of(type.volume_m3)
  }
  return formatVolumeM3(sum)
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
    label: `${t.name} — ${formatVolumeM3(t.volume_m3)}`,
  })),
)

// Колонка адреса появляется только при включённых ячейках: без них у бокса
// адреса не бывает, и пустой столбец только занимал бы место.
const containerColumns = computed<BaseTableColumn<MarketplaceContainerView>[]>(() => [
  { key: 'code', label: i18nT('marketplace.operatorContainers.column.code'), width: '160px', sortable: true, field: 'code' },
  {
    key: 'type',
    label: i18nT('marketplace.operatorContainers.column.type'),
    width: '200px',
    sortable: true,
    field: (row) => typeNameOf(row),
  },
  {
    key: 'volume',
    label: i18nT('marketplace.operatorContainers.column.volume'),
    width: '110px',
    numeric: true,
    nowrap: true,
    field: (row) => volumeOf(row),
  },
  ...(cellsEnabled.value
    ? [
        {
          key: 'cell',
          label: i18nT('marketplace.operatorContainers.column.cell'),
          width: '140px',
          sortable: true,
          field: (row: MarketplaceContainerView) => cellCodeOf(row),
        },
      ]
    : []),
  {
    key: 'count',
    label: i18nT('marketplace.operatorContainers.column.count'),
    width: '100px',
    numeric: true,
    sortable: true,
    field: (row) => itemsOf(row).length,
  },
  { key: 'contents', label: i18nT('marketplace.operatorContainers.column.contents'), width: '260px', field: (row) => contentsOf(row) },
  { key: 'actions', label: '', width: '56px', align: 'right' },
])


/**
 * Пересобрать выбор на свежих строках: после перезагрузки в `selectedContainers`
 * остались бы прежние объекты, и печать пошла бы по устаревшим данным. Заодно
 * из выбора выпадают боксы, которых больше нет (сменили участок, вывели из
 * оборота).
 */
function syncSelection(): void {
  if (!selectedContainers.value.length) return
  const byId = new Map(storage.activeContainers.map((c) => [c.id, c] as const))
  selectedContainers.value = selectedContainers.value
    .map((c) => byId.get(c.id))
    .filter((c): c is MarketplaceContainerView => Boolean(c))
}

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
    syncSelection()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorContainers.loadError'))
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
    printLabelSheet({ title: i18nT('marketplace.operatorContainers.labelSheetTitle'), labels })
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorContainers.labelBuildError'))
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
        ? i18nT('marketplace.operatorContainers.createdOneMessage', { code: created[0]?.code })
        : i18nT('marketplace.operatorContainers.createdManyMessage', { count: created.length, firstCode: created[0]?.code, lastCode: created[created.length - 1]?.code }),
    )
    batchOpen.value = false
    await load()
    // Печать сразу после заведения — этикетки нужны на новые боксы, а не когда-то.
    await printLabels(created)
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorContainers.createError'))
  } finally {
    batchSaving.value = false
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
        ? i18nT('marketplace.operatorContainers.placedMessage', { code: target.code })
        : i18nT('marketplace.operatorContainers.unplacedMessage', { code: target.code }),
    )
    placeOpen.value = false
    await load()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorContainers.placeError'))
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
    SuccessAlert(i18nT('marketplace.operatorContainers.retiredMessage', { code: container.code }))
    await load()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorContainers.retireError'))
  } finally {
    retiringId.value = null
  }
}

// Боксы и ячейки живут по ленте: раскладка, перемещение и выдача из бокса
// перечитывают раздел.
useLiveReload(marketLiveTables('warehouse'), load)
</script>

<template lang="pug">
//- Секция стола «Склад моего КУ»: шапка участка и полоса разделов — на
//- странице-обёртке. Какой из двух справочников показывать, говорит проп.
.containers(role='region', :aria-label='$t("marketplace.operatorContainers.ariaLabel")')
  EmptyState(
    v-if='branchStore.loaded && !branchStore.isOperator',
    :title='$t("marketplace.operatorContainers.notOperatorTitle")',
    :body='$t("marketplace.operatorContainers.notOperatorBody")'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    Teleport(to='#header-actions-host', defer)
      .containers__head-actions
        BaseButton(
          variant='secondary',
          size='sm',
          :loading='printing',
          :disabled='!storage.activeContainers.length',
          @click='printLabels(storage.activeContainers)'
        )
          template(#icon-left)
            q-icon(name='print', size='16px')
          | {{ $t('marketplace.operatorContainers.printAllButton') }}
        BaseButton(
          variant='primary',
          size='sm',
          :disabled='!storage.activeTypes.length',
          @click='openBatch'
        )
          template(#icon-left)
            q-icon(name='add', size='16px')
          | {{ $t('marketplace.operatorContainers.createButton') }}

    PageHint(storage-key='mp:operator-containers:banner-dismissed')
      | {{ $t('marketplace.operatorContainers.hintLine1') }}
      | {{ $t('marketplace.operatorContainers.hintLine2') }}
      | {{ $t('marketplace.operatorContainers.hintLine3') }}
      | {{ $t('marketplace.operatorContainers.hintLine4') }}

    //- Печать отмеченного стоит над таблицей, а не в шапке страницы: действие
    //- относится к текущему выбору в таблице, а не к разделу целиком.
    .containers__bulk(v-if='selectedContainers.length')
      BaseButton(
        variant='primary',
        size='sm',
        :loading='printing',
        @click='printLabels(selectedContainers)'
      )
        template(#icon-left)
          q-icon(name='print', size='16px')
        | {{ $t('marketplace.operatorContainers.printSelectedButton', { count: selectedContainers.length }) }}

    //- ─────────────────────────── Боксы ───────────────────────────
    EmptyState(
      v-if='!firstLoad && !storage.activeTypes.length',
      :title='$t("marketplace.operatorContainers.noTypesTitle")',
      :body='$t("marketplace.operatorContainers.noTypesBody")'
    )
      template(#icon)
        q-icon(name='straighten', size='48px')

    BaseTable(
      v-else-if='firstLoad || storage.activeContainers.length',
      :columns='containerColumns',
      :rows='storage.activeContainers',
      row-key='id',
      hover,
      sticky-header,
      selection='multiple',
      v-model:selected='selectedContainers',
      :loading='loading',
      min-width='980px',
      sort-by='code',
      clickable-rows,
      @row-click='openContainer'
    )
      template(#cell-code='{ row }')
        span.containers__code {{ row.code }}
        .containers__sub(v-if='row.label') {{ row.label }}
      template(#cell-cell='{ row }')
        span(v-if='row.cell_id') {{ cellCodeOf(row) }}
        BaseBadge(v-else, variant='neutral') {{ $t('marketplace.operatorContainers.noAddressLabel') }}
      template(#cell-contents='{ row }')
        span.containers__contents {{ contentsOf(row) }}
      template(#cell-actions='{ row }')
        .containers__row-actions
          BaseButton(variant='ghost', size='sm', icon-only, :aria-label='$t("marketplace.operatorContainers.rowActionsAriaLabel")')
            template(#icon-left)
              q-icon(name='more_vert', size='18px')
              q-menu(anchor='bottom right', self='top right')
                q-list(dense, style='min-width: 220px')
                  q-item(v-if='cellsEnabled', clickable, v-close-popup, @click='openPlace(row)')
                    q-item-section(avatar)
                      q-icon(name='grid_view', size='18px')
                    q-item-section {{ row.cell_id ? $t('marketplace.operatorContainers.relocateAction') : $t('marketplace.operatorContainers.placeAction') }}
                  q-item(v-if='!itemsOf(row).length', clickable, v-close-popup, @click='retire(row)')
                    q-item-section(avatar)
                      q-icon(name='archive', size='18px')
                    q-item-section {{ $t('marketplace.operatorContainers.retireAction') }}
                  q-item(v-else, disable)
                    q-item-section(avatar)
                      q-icon(name='info', size='18px')
                    q-item-section {{ $t('marketplace.operatorContainers.retireDisabledHint') }}
      template(#footer)
        span {{ $t('marketplace.operatorContainers.summaryText', { count: storage.activeContainers.length, volume: totalVolume }) }}

    EmptyState(
      v-else,
      :title='$t("marketplace.operatorContainers.emptyTitle")',
      :body='$t("marketplace.operatorContainers.emptyBody")'
    )
      template(#icon)
        q-icon(name='inbox', size='48px')

  ContainerContentsDrawer(
    v-model='contentsOpen',
    :container='openedContainer',
    :items='openedItems',
    :branch-name='branchName',
    :branch-address='branchAddress',
    :type-name='openedContainer ? typeNameOf(openedContainer) : ""',
    :volume='openedContainer ? volumeOf(openedContainer) : ""',
    :cell-code='openedContainer ? cellCodeOf(openedContainer) : ""'
  )

  //- ─────────────────────── Диалог: партия боксов ───────────────────────
  BaseDialog(v-model='batchOpen', :title='$t("marketplace.operatorContainers.batchDialogTitle")', size='sm')
    .containers__form
      .containers__note
        | {{ $t('marketplace.operatorContainers.batchNoteLine1') }}
        | {{ $t('marketplace.operatorContainers.batchNoteLine2') }}
      BaseSelect(v-model='batchTypeId', :options='typeOptions', :label='$t("marketplace.operatorContainers.batchTypeLabel")')
      BaseInput(v-model.number='batchCount', type='number', :label='$t("marketplace.operatorContainers.batchCountLabel")')
      BaseInput(v-model='batchLabel', :label='$t("marketplace.operatorContainers.batchLabelLabel")', :placeholder='$t("marketplace.operatorContainers.batchLabelPlaceholder")')
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='batchSaving', @click='batchOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', size='sm', :loading='batchSaving', :disabled='!batchValid', @click='submitBatch') {{ $t('marketplace.operatorContainers.batchSubmit') }}

  //- ─────────────────────── Диалог: поставить в ячейку ───────────────────────
  BaseDialog(v-model='placeOpen', :title='$t("marketplace.operatorContainers.placeDialogTitle")', size='sm')
    .containers__form(v-if='placeTarget')
      .containers__note
        | {{ $t('marketplace.operatorContainers.placeNoteLine1', { boxLabel: containerLabel(placeTarget, storage.index) }) }}
        | {{ $t('marketplace.operatorContainers.placeNoteLine2') }}
      BaseSelect(v-model='placeCellId', :options='cellOptions', :label='$t("marketplace.operatorContainers.placeCellLabel")')
    template(#footer)
      BaseButton(variant='ghost', size='sm', :disabled='placeSaving', @click='placeOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(
        variant='secondary',
        size='sm',
        :disabled='placeSaving || !placeCellId',
        @click='placeCellId = null'
      ) {{ $t('marketplace.operatorContainers.placeClearButton') }}
      BaseButton(variant='primary', size='sm', :loading='placeSaving', @click='submitPlace') {{ $t('common.action.save') }}
</template>

<style scoped lang="scss">
.containers {
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

@media (max-width: 768px) {
  .containers {
    padding: var(--p-4, 16px);

    &__dims {
      grid-template-columns: 1fr;
    }
  }
}
</style>
