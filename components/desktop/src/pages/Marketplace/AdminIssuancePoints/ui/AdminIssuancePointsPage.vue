<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { useBranchStore } from 'src/entities/Branch/model'
import type { IBranch } from 'src/entities/Branch/model'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
// GeocodeStatus/KuDetailsStatus — это ЗНАЧЕНИЯ (enum из Zeus), используются в
// рантайме (GeocodeStatus.OK и т.п.); импортировать как value, не `import type`,
// иначе тип стирается при компиляции → ReferenceError в шаблоне.
import { GeocodeStatus, KuDetailsStatus } from 'src/entities/MarketplaceKUDetails'
import type { IMarketplaceKUDetails } from 'src/entities/MarketplaceKUDetails'
import { BaseBadge, BaseButton, BaseDialog, EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base'
import { IdentityCell, PageHint } from 'src/shared/ui/domain'
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace'
// Map экспортируется как `Map` — импортируем под алиасом, чтобы не затенять
// глобальный `Map` (используется в `rows`).
import { Map as MapView } from 'src/shared/ui/Map'
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

function branchName(row: IssuancePointRow): string {
  return row.branch.short_name || row.branch.full_name || ''
}

function addressOf(row: IssuancePointRow): string {
  return (
    row.details?.addressFull ||
    row.branch.fact_address ||
    row.branch.full_address ||
    '—'
  )
}

// Карта ПВЗ: открываем точку по координатам геокодера (OSM, без API-ключа).
const mapOpen = ref(false)
const mapRow = ref<IssuancePointRow | null>(null)
const mapTitle = computed(() =>
  mapRow.value
    ? `Карта — ${mapRow.value.branch.short_name || mapRow.value.branch.full_name || mapRow.value.branch.braname}`
    : 'Карта',
)

function hasCoords(row: IssuancePointRow): boolean {
  const d = row.details
  return !!d && d.geocodeStatus === GeocodeStatus.OK && d.lat != null && d.lng != null
}

function openMap(row: IssuancePointRow): void {
  mapRow.value = row
  mapOpen.value = true
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
    SuccessAlert(status === KuDetailsStatus.ACTIVE ? 'Пункт выдачи активирован' : 'Пункт выдачи деактивирован')
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

// Фоновое обновление вместо кнопки: геокодер проставляет координаты
// асинхронно после сохранения адреса — статус доезжает страховочным
// resync'ом канала (60с) и catch-up'ом на возврат вкладки. Собственных
// realtime-событий у КУ-деталей нет (изменения делает сам админ).
const reloadLive = debounce(() => {
  if (loading.value) return
  void load()
}, 400)
useMarketplaceRealtime({}, { onResync: () => reloadLive() })

onMounted(() => {
  void load()
})
</script>

<template lang="pug">
q-page.admin-pvz
  PageHint(storage-key='mp:admin-pvz:banner-dismissed')
    | Пункты выдачи заказов — это кооперативные участки, подключённые к Столу
    | заказов. Участки создаются на столе совета; здесь председатель делает их
    | пунктами выдачи, указывая фактический адрес, контакты и режим работы.
    | Адрес геокодируется автоматически для карты.

  .admin-pvz__toolbar
    .admin-pvz__counter(v-if='!loading && rows.length')
      | Подключено пунктов выдачи: {{ connectedCount }} из {{ rows.length }}

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
              IdentityCell(
                :account-name='row.branch.braname',
                :full-name='branchName(row)'
              )
            td.col-city {{ row.branch.city || '—' }}
            td.admin-pvz__address {{ addressOf(row) }}
            td.col-status
              BaseBadge(:variant='statusOf(row).variant') {{ statusOf(row).label }}
            td.col-geo
              .admin-pvz__geo(v-if='row.details')
                BaseBadge(:variant='GEOCODE_LABEL[row.details.geocodeStatus].variant')
                  | {{ GEOCODE_LABEL[row.details.geocodeStatus].label }}
                  q-tooltip(
                    v-if='row.details.geocodeStatus === GeocodeStatus.FAILED && row.details.geocodeErrorMessage'
                  ) {{ row.details.geocodeErrorMessage }}
                BaseButton(
                  v-if='hasCoords(row)',
                  variant='ghost',
                  icon-only,
                  size='sm',
                  aria-label='Открыть карту',
                  @click='openMap(row)'
                )
                  template(#icon-left)
                    q-icon(name='map', size='18px')
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
                    v-if='row.details.geocodeStatus !== GeocodeStatus.OK',
                    variant='ghost',
                    icon-only,
                    size='sm',
                    aria-label='Перезапустить геокодинг',
                    @click='retryGeocode(row)'
                  )
                    template(#icon-left)
                      q-icon(name='my_location', size='18px')
                  BaseButton(
                    v-if='row.details.status === KuDetailsStatus.ACTIVE',
                    variant='ghost',
                    icon-only,
                    size='sm',
                    aria-label='Деактивировать',
                    @click='setStatus(row, KuDetailsStatus.INACTIVE)'
                  )
                    template(#icon-left)
                      q-icon(name='block', size='18px')
                  BaseButton(
                    v-else,
                    variant='ghost',
                    icon-only,
                    size='sm',
                    aria-label='Активировать',
                    @click='setStatus(row, KuDetailsStatus.ACTIVE)'
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

  BaseDialog(v-model='mapOpen', :title='mapTitle', size='lg')
    .admin-pvz__map(
      v-if='mapRow && mapRow.details && mapRow.details.lat != null && mapRow.details.lng != null'
    )
      .admin-pvz__map-addr {{ mapRow.details.addressFull }}
      MapView(:long='Number(mapRow.details.lng)', :lat='Number(mapRow.details.lat)')
</template>

<style scoped lang="scss">
.admin-pvz {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
  }

  &__counter {
    color: var(--p-ink-3);
    font-size: 0.875rem;
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

  &__geo {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
  }

  &__map-addr {
    color: var(--p-ink-2);
    margin-bottom: var(--p-3, 12px);
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
