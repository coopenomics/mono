<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loading } from 'quasar'
import { Zeus } from '@coopenomics/sdk'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay'
import { BaseBadge, BaseButton, BaseDialog, BaseInput, EmptyState } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton'
import {
  assignInventoryShelf,
  fetchInventoryByBraname,
  generateInventoryLabel,
  splitInventory,
  type MarketplaceInventoryItemView,
} from '../api'

/**
 * Стол ПВЗ, «Раскладка и маркировка». Имущество попадает на склад на приёмке
 * (статус RECEIVED) — здесь оператор организует его физически: назначает полку
 * (свободная строка), при необходимости раскладывает одну принятую позицию по
 * нескольким полкам (split), и опционально наклеивает штрих-код для быстрого
 * поиска. Штрих-код не обязателен — склад работает и без него (один холодильник).
 */

const route = useRoute()
const store = useOperatorBranchStore()
const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')

const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(false)

// Сначала непромаркированные/без полки (нужно разложить), затем остальное.
const RECEIVED = Zeus.MarketplaceInventoryStatus.RECEIVED
const LABELED = Zeus.MarketplaceInventoryStatus.LABELED

const onWarehouse = computed(() =>
  [...items.value]
    .filter((i) => i.status === RECEIVED || i.status === LABELED)
    .sort((a, b) => {
      // Сперва то, чем ещё нужно заняться: без полки, затем без штрих-кода.
      const aw = (a.shelf ? 0 : 2) + (a.barcode_value ? 0 : 1)
      const bw = (b.shelf ? 0 : 2) + (b.barcode_value ? 0 : 1)
      return bw - aw
    }),
)

const labeledItems = computed(() => items.value.filter((i) => !!i.barcode_value))

// Черновик полки на строку — чтобы сохранять только по явному действию.
const shelfDraft = reactive<Record<string, string>>({})

async function load(): Promise<void> {
  if (!braname.value.trim()) {
    items.value = []
    return
  }
  loading.value = true
  try {
    items.value = await fetchInventoryByBraname(braname.value.trim())
    for (const i of items.value) shelfDraft[i.id] = i.shelf ?? ''
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить склад участка')
  } finally {
    loading.value = false
  }
}

async function saveShelf(item: MarketplaceInventoryItemView): Promise<void> {
  const next = (shelfDraft[item.id] ?? '').trim()
  if (next === (item.shelf ?? '')) return
  try {
    await assignInventoryShelf({ inventory_id: item.id, shelf: next || null })
    SuccessAlert(next ? `Полка «${next}» сохранена` : 'Полка очищена')
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось сохранить полку')
  }
}

async function makeLabel(item: MarketplaceInventoryItemView): Promise<void> {
  Loading.show({ message: 'Генерирую этикетку…' })
  try {
    await generateInventoryLabel({ inventory_id: item.id })
    SuccessAlert('Этикетка сгенерирована — можно печатать')
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось сгенерировать этикетку')
  } finally {
    Loading.hide()
  }
}

// ── Раскладка по полкам (split) ──
const splitDialogOpen = ref(false)
const splitTarget = ref<MarketplaceInventoryItemView | null>(null)
const splitRows = ref<{ quantity: number | null; shelf: string }[]>([])

const splitTotal = computed(() =>
  splitRows.value.reduce((a, r) => a + (Number(r.quantity) || 0), 0),
)
const splitValid = computed(
  () =>
    !!splitTarget.value &&
    splitRows.value.length >= 1 &&
    splitRows.value.every((r) => Number(r.quantity) > 0) &&
    splitTotal.value === splitTarget.value.quantity_per_label,
)

function openSplit(item: MarketplaceInventoryItemView): void {
  splitTarget.value = item
  // Предзаполняем двумя долями: текущая полка + пустая.
  splitRows.value = [
    { quantity: item.quantity_per_label, shelf: item.shelf ?? '' },
    { quantity: null, shelf: '' },
  ]
  splitDialogOpen.value = true
}

function addSplitRow(): void {
  splitRows.value.push({ quantity: null, shelf: '' })
}
function removeSplitRow(idx: number): void {
  splitRows.value.splice(idx, 1)
}

async function applySplit(): Promise<void> {
  if (!splitTarget.value || !splitValid.value) return
  const target = splitTarget.value
  splitDialogOpen.value = false
  Loading.show({ message: 'Раскладываю по полкам…' })
  try {
    await splitInventory({
      inventory_id: target.id,
      splits: splitRows.value.map((r) => ({
        quantity: Number(r.quantity),
        shelf: r.shelf.trim() || null,
      })),
    })
    SuccessAlert(`Позиция разложена на ${splitRows.value.length} полок(и)`)
    await load()
  } catch (e) {
    FailAlert(e, 'Не удалось разложить позицию')
  } finally {
    Loading.hide()
  }
}

function openPrintWindow(): void {
  window.print()
}

watch(braname, () => void load())

onMounted(async () => {
  await store.ensureLoaded(coopname.value)
  void load()
})
</script>

<template lang="pug">
q-page.place(role='region', aria-label='Раскладка и маркировка')
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
      BaseButton(variant='secondary', size='sm', :disabled='!labeledItems.length', @click='openPrintWindow')
        template(#icon-left)
          q-icon(name='print', size='16px')
        | Печать этикеток
      RefreshButton(:loading='loading', @refresh='load')

    PageHint.no-print(storage-key='mp:operator-labeling:banner-dismissed')
      | Принятое имущество лежит на складе сразу. Назначьте каждой позиции полку
      | (свободная строка), при необходимости разложите одну позицию по нескольким
      | полкам и — по желанию — наклейте штрих-код для быстрого поиска. Штрих-код
      | не обязателен: если у вас один холодильник, можно обойтись без него.

    EmptyState.no-print(
      v-if='!onWarehouse.length',
      title='На складе пусто',
      body='Здесь появятся принятые позиции — после приёмки партии на столе «Приёмка партии».'
    )
      template(#icon)
        q-icon(name='inventory_2', size='48px')

    .place__list.no-print(v-else)
      .place__item(v-for='item in onWarehouse', :key='item.id')
        .place__item-info
          .place__item-name {{ item.product_name_snapshot || 'Товар по предложению' }}
          .place__item-meta
            | Принято {{ item.quantity_per_label }} ед. · {{ item.orderer_account_snapshot }}
          BaseBadge(v-if='item.barcode_value', variant='pos') Промаркировано
          BaseBadge(v-else, variant='neutral') Без штрих-кода
        .place__item-controls
          BaseInput.place__shelf(
            v-model='shelfDraft[item.id]',
            label='Полка',
            placeholder='A-12',
            dense,
            @blur='saveShelf(item)',
            @keydown.enter='saveShelf(item)'
          )
          BaseButton(
            variant='ghost',
            size='sm',
            :disabled='!!item.barcode_value || item.quantity_per_label < 2',
            @click='openSplit(item)'
          )
            template(#icon-left)
              q-icon(name='call_split', size='16px')
            | Разложить
          BaseButton(
            v-if='!item.barcode_value',
            variant='primary',
            size='sm',
            @click='makeLabel(item)'
          )
            template(#icon-left)
              q-icon(name='qr_code_2', size='16px')
            | Этикетка

    //- Печатная раскладка этикеток — только промаркированные позиции.
    .place__grid(v-if='labeledItems.length')
      .place__label(v-for='item in labeledItems', :key='item.id')
        .place__label-name.ellipsis {{ item.product_name_snapshot }}
        .place__label-meta.ellipsis
          | Пайщик: {{ item.orderer_account_snapshot }} · Кол-во: {{ item.quantity_per_label }}
          template(v-if='item.shelf')  · Полка: {{ item.shelf }}
        BarcodeDisplay(v-if='item.barcode_value', :code='item.barcode_value', size='md')

  BaseDialog(v-model='splitDialogOpen', title='Разложить по полкам', size='md')
    .place__split(v-if='splitTarget')
      .place__split-head
        | {{ splitTarget.product_name_snapshot || 'Товар' }} — всего {{ splitTarget.quantity_per_label }} ед.
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
        span.place__split-total(:class='{ "place__split-total--bad": splitTotal !== splitTarget.quantity_per_label }')
          | Сумма: {{ splitTotal }} / {{ splitTarget.quantity_per_label }}
    template(#footer)
      BaseButton(variant='ghost', size='sm', @click='splitDialogOpen = false') Отмена
      BaseButton(variant='primary', size='sm', :disabled='!splitValid', @click='applySplit') Разложить
</template>

<style scoped lang="scss">
.place {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-3, 12px) var(--p-4, 16px);
  }

  &__item-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__item-name {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__item-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__item-controls {
    display: flex;
    align-items: flex-end;
    gap: var(--p-2, 8px);
    flex-wrap: wrap;
  }

  &__shelf {
    width: 120px;
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
      color: var(--p-danger, #b3261e);
      font-weight: 600;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--p-4, 16px);
  }

  &__label {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    padding: var(--p-3, 12px);
    background: var(--p-surface);
    break-inside: avoid;
  }

  &__label-name {
    font-weight: 600;
  }

  &__label-meta {
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm);
    margin-bottom: var(--p-1, 4px);
  }
}

@media (max-width: 768px) {
  .place {
    padding: var(--p-4, 16px);
  }
}

@media print {
  .no-print {
    display: none !important;
  }
  .place {
    padding: 0;
  }
  .place__grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 4mm;
  }
  .place__label {
    page-break-inside: avoid;
    width: 100%;
  }
  @page {
    size: A4;
    margin: 8mm;
  }
}
</style>
