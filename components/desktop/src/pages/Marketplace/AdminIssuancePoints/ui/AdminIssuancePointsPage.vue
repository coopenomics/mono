<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useDismissibleBanner } from 'src/shared/hooks'
import { useSessionStore } from 'src/entities/Session'
import { useBranchStore } from 'src/entities/Branch/model'
import type { IBranch } from 'src/entities/Branch/model'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import type {
  GeocodeStatus,
  IMarketplaceKUDetails,
  KuDetailsStatus,
} from 'src/entities/MarketplaceKUDetails'
import { BaseBadge, BaseButton, EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base'
import { MarketplaceDetailKUDialog } from 'src/features/MarketplaceDetailKU'

/**
 * Эпик 2: admin-стол «Пункты выдачи заказов».
 *
 * Соединяет список ВСЕХ кооперативных участков кооператива (core `getBranches`,
 * создаются на столе совета) с их marketplace-детализациями ПВЗ
 * (`marketplaceListKUDetails`). Председатель видит, какие КУ уже подключены как
 * пункты выдачи, и подключает новые: «Сделать ПВЗ» открывает диалог с
 * предзаполнением адреса/контактов из карточки КУ → `marketplaceDetailKU`.
 *
 * Управляющие действия (подключить/изменить/геокодинг/активация) — только
 * председателю; совет видит сеть ПВЗ в режиме чтения.
 */

const route = useRoute()
const session = useSessionStore()
const branchStore = useBranchStore()
const kuStore = useMarketplaceKUDetailsStore()

const coopname = computed(() => String(route.params.coopname ?? ''))
const isChairman = computed(() => session.isChairman ?? false)

const loading = ref(false)
const { dismissed: bannerDismissed, dismiss: dismissBanner } = useDismissibleBanner(
  'mp:admin-pvz:banner-dismissed',
)

const dialogOpen = ref(false)
const dialogBranch = ref<IBranch | null>(null)
const dialogExisting = ref<IMarketplaceKUDetails | null>(null)

interface IssuancePointRow {
  branch: IBranch
  details: IMarketplaceKUDetails | null
}

// КУ + его ПВЗ-детализация (если подключён). КУ без детализации — кандидат
// на подключение; подключённые показываются со статусом и геокодом.
const rows = computed<IssuancePointRow[]>(() => {
  const byBraname = new Map(kuStore.details.map((d) => [d.coreBraname, d]))
  return branchStore.branches.map((branch) => ({
    branch,
    details: byBraname.get(branch.braname) ?? null,
  }))
})

const connectedCount = computed(() => rows.value.filter((r) => r.details).length)

const STATUS_LABEL: Record<KuDetailsStatus, { label: string; variant: BaseBadgeVariant }> = {
  ACTIVE: { label: 'Активен', variant: 'pos' },
  INACTIVE: { label: 'Деактивирован', variant: 'neutral' },
}

const GEOCODE_LABEL: Record<GeocodeStatus, { label: string; variant: BaseBadgeVariant }> = {
  OK: { label: 'Координаты есть', variant: 'pos' },
  PENDING: { label: 'Определяются…', variant: 'warn' },
  FAILED: { label: 'Ошибка геокода', variant: 'neg' },
}

function statusOf(row: IssuancePointRow): { label: string; variant: BaseBadgeVariant } {
  if (!row.details) return { label: 'Не подключён', variant: 'neutral' }
  return STATUS_LABEL[row.details.status]
}

function addressOf(row: IssuancePointRow): string {
  if (row.details) return row.details.addressFull
  return row.branch.fact_address || row.branch.full_address || '—'
}

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Участок', cell: 'text' },
  { label: 'Город', cell: 'text', cellWidth: '120px' },
  { label: 'Адрес', cell: 'text' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Геокод', cell: 'badge' },
  { label: 'Действия', class: 'col-action', cell: 'icon' },
]

async function load(): Promise<void> {
  loading.value = true
  try {
    await Promise.all([
      branchStore.loadBranches({ coopname: coopname.value }),
      kuStore.load({ coopname: coopname.value, onlyActive: false }),
    ])
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить участки и пункты выдачи')
  } finally {
    loading.value = false
  }
}

function openAdd(branch: IBranch): void {
  dialogBranch.value = branch
  dialogExisting.value = null
  dialogOpen.value = true
}

function openEdit(row: IssuancePointRow): void {
  dialogBranch.value = row.branch
  dialogExisting.value = row.details
  dialogOpen.value = true
}

async function onSaved(): Promise<void> {
  await load()
}

async function setStatus(row: IssuancePointRow, status: KuDetailsStatus): Promise<void> {
  try {
    await kuStore.setStatus({ coopname: coopname.value, coreBraname: row.branch.braname, status })
    SuccessAlert(status === 'ACTIVE' ? 'Пункт выдачи активирован' : 'Пункт выдачи деактивирован')
  } catch (e) {
    FailAlert(e, 'Не удалось изменить статус пункта выдачи')
  }
}

async function retryGeocode(row: IssuancePointRow): Promise<void> {
  try {
    await kuStore.retryGeocode(coopname.value, row.branch.braname)
    SuccessAlert('Геокодинг адреса перезапущен')
  } catch (e) {
    FailAlert(e, 'Не удалось перезапустить геокодинг')
  }
}

onMounted(() => {
  void load()
})
</script>

<template lang="pug">
q-page.admin-pvz
  .banner.banner--info(v-if='!bannerDismissed')
    q-icon.banner__icon(name='info', size='18px')
    .banner__body
      | Пункты выдачи заказов — это кооперативные участки, подключённые к Столу
      | заказов. Участки создаются на столе совета; здесь председатель делает их
      | пунктами выдачи, указывая фактический адрес, контакты и режим работы.
      | Адрес геокодируется автоматически для карты.
    BaseButton.admin-pvz__banner-close(
      variant='ghost',
      icon-only,
      size='sm',
      aria-label='Скрыть подсказку',
      @click='dismissBanner'
    )
      template(#icon-left)
        q-icon(name='close', size='16px')

  .admin-pvz__toolbar
    .admin-pvz__counter(v-if='!loading && rows.length')
      | Подключено пунктов выдачи: {{ connectedCount }} из {{ rows.length }}
    q-space
    BaseButton(
      variant='ghost',
      icon-only,
      aria-label='Обновить',
      :loading='loading',
      @click='load'
    )
      template(#icon-left)
        q-icon(name='refresh', size='20px')

  TableSkeleton(
    v-if='loading && !rows.length',
    :columns='skeletonColumns',
    :rows='5',
    min-width='980px'
  )
  .table-wrap(v-else-if='rows.length')
    .table-scroll
      table.table
        thead
          tr
            th.col-ku Участок
            th.col-city Город
            th Адрес
            th.col-status Статус
            th.col-geo Геокод
            th.col-action Действия
        tbody
          tr(v-for='row in rows', :key='row.branch.braname')
            td.col-ku
              .admin-pvz__ku-name {{ row.branch.short_name || row.branch.full_name || row.branch.braname }}
              .admin-pvz__ku-acc {{ row.branch.braname }}
            td.col-city {{ row.branch.city || '—' }}
            td.admin-pvz__address {{ addressOf(row) }}
            td.col-status
              BaseBadge(:variant='statusOf(row).variant') {{ statusOf(row).label }}
            td.col-geo
              BaseBadge(
                v-if='row.details',
                :variant='GEOCODE_LABEL[row.details.geocodeStatus].variant'
              )
                | {{ GEOCODE_LABEL[row.details.geocodeStatus].label }}
                q-tooltip(
                  v-if='row.details.geocodeStatus === "FAILED" && row.details.geocodeErrorMessage'
                ) {{ row.details.geocodeErrorMessage }}
              span.admin-pvz__dash(v-else) —
            td.col-action
              template(v-if='isChairman')
                BaseButton(
                  v-if='!row.details',
                  variant='primary',
                  size='sm',
                  @click='openAdd(row.branch)'
                )
                  template(#icon-left)
                    q-icon(name='add_location_alt', size='16px')
                  | Сделать ПВЗ
                .admin-pvz__actions(v-else)
                  BaseButton(
                    variant='ghost',
                    icon-only,
                    size='sm',
                    aria-label='Изменить',
                    @click='openEdit(row)'
                  )
                    template(#icon-left)
                      q-icon(name='edit', size='18px')
                  BaseButton(
                    v-if='row.details.geocodeStatus !== "OK"',
                    variant='ghost',
                    icon-only,
                    size='sm',
                    aria-label='Перезапустить геокодинг',
                    @click='retryGeocode(row)'
                  )
                    template(#icon-left)
                      q-icon(name='my_location', size='18px')
                  BaseButton(
                    v-if='row.details.status === "ACTIVE"',
                    variant='ghost',
                    icon-only,
                    size='sm',
                    aria-label='Деактивировать',
                    @click='setStatus(row, "INACTIVE")'
                  )
                    template(#icon-left)
                      q-icon(name='block', size='18px')
                  BaseButton(
                    v-else,
                    variant='ghost',
                    icon-only,
                    size='sm',
                    aria-label='Активировать',
                    @click='setStatus(row, "ACTIVE")'
                  )
                    template(#icon-left)
                      q-icon(name='check_circle', size='18px')
              span.admin-pvz__dash(v-else) —

  EmptyState(
    v-else,
    title='Кооперативных участков нет',
    body='Создайте кооперативный участок на столе совета — после этого его можно будет подключить как пункт выдачи заказов.'
  )
    template(#icon)
      q-icon(name='pin_drop', size='48px')

  MarketplaceDetailKUDialog(
    v-if='dialogBranch',
    v-model='dialogOpen',
    :coopname='coopname',
    :core-braname='dialogBranch.braname',
    :existing='dialogExisting',
    :branch='dialogBranch',
    @saved='onSaved'
  )
</template>

<style scoped lang="scss">
.admin-pvz {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__banner-close {
    flex-shrink: 0;
    align-self: flex-start;
    margin: -4px -4px 0 0;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
  }

  &__counter {
    color: var(--p-ink-3);
    font-size: 0.875rem;
  }

  &__ku-name {
    font-weight: 600;
  }

  &__ku-acc {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--p-ink-3);
  }

  &__address {
    color: var(--p-ink-2);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--p-1, 4px);
  }

  &__dash {
    color: var(--p-ink-3);
  }
}

.table-scroll {
  overflow-x: auto;
}
.table {
  table-layout: fixed;
  min-width: 980px;
}
.col-ku {
  width: 240px;
}
.col-city {
  width: 140px;
}
.col-status {
  width: 160px;
}
.col-geo {
  width: 170px;
}
.col-action {
  width: 200px;
  text-align: right;
}

@media (max-width: 768px) {
  .admin-pvz {
    padding: var(--p-4, 16px);
  }
}
</style>
