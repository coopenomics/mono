<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useLiveReload } from 'src/shared/lib/realtime';
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
import { BaseBadge, BaseButton, BaseDialog, BaseSelect, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base'
import { IdentityCell, PageHint } from 'src/shared/ui/domain'
import { useFirstLoad } from 'src/shared/lib/composables'
import { marketLiveTables } from 'src/shared/lib/marketplace';
// Map экспортируется как `Map` — импортируем под алиасом, чтобы не затенять
// глобальный `Map` (используется в `rows`).
import { Map as MapView } from 'src/shared/ui/Map'
import { MarketplaceDetailKUDialog } from 'src/features/MarketplaceDetailKU'
import { t } from 'src/shared/i18n';
import { getBranchInitiator, setBranchInitiator, type MarketplaceBranchInitiatorView } from '../api'

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
 *
 * Инициатор участка (коэффициент экономического участия, 99D-23): получатель
 * доли экономии месяца. По умолчанию — председатель участка; администратор
 * назначает другого пайщика из состава участка, пустой выбор возвращает
 * председателя. Прошедшие месяцы назначение не трогает.
 */

const route = useRoute()
const session = useSessionStore()
const branchStore = useBranchStore()
const kuStore = useMarketplaceKUDetailsStore()

const coopname = computed(() => String(route.params.coopname ?? ''))
const isChairman = computed(() => session.isChairman ?? false)

// true до первого запроса: иначе первый кадр до загрузки показывает пустое
// состояние вместо скелетона, и первая загрузка неотличима от пустого списка.
const loading = ref(true)
/** Скелетон — только на первой загрузке; дочитка обновляет молча. */
const firstLoad = useFirstLoad(loading)
// Ручной перезапуск геокода — показываем лоадер на кнопке, пока мутация идёт.
const geocodingBranames = ref<Set<string>>(new Set())

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
  ACTIVE: { label: t('marketplace.issuancePoints.status.active'), variant: 'pos' },
  INACTIVE: { label: t('marketplace.issuancePoints.status.inactive'), variant: 'neutral' },
}

const GEOCODE_LABEL: Record<GeocodeStatus, { label: string; variant: BaseBadgeVariant }> = {
  OK: { label: t('marketplace.issuancePoints.status.geocoded'), variant: 'pos' },
  PENDING: { label: t('marketplace.issuancePoints.status.geocoding'), variant: 'warn' },
  FAILED: { label: t('marketplace.issuancePoints.status.geocodeError'), variant: 'neg' },
}

function statusOf(row: IssuancePointRow): { label: string; variant: BaseBadgeVariant } {
  if (!row.details) return { label: t('marketplace.issuancePoints.status.notConnected'), variant: 'neutral' }
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
    ? t('marketplace.issuancePoints.mapDialogTitle', { branchName: mapRow.value.branch.short_name || mapRow.value.branch.full_name || mapRow.value.branch.braname })
    : t('marketplace.issuancePoints.mapButton'),
)

function hasCoords(row: IssuancePointRow): boolean {
  const d = row.details
  return !!d && d.geocodeStatus === GeocodeStatus.OK && d.lat != null && d.lng != null
}

function openMap(row: IssuancePointRow): void {
  mapRow.value = row
  mapOpen.value = true
}

function isGeocodingRow(row: IssuancePointRow): boolean {
  return geocodingBranames.value.has(row.branch.braname)
}

function isGeocodePending(row: IssuancePointRow): boolean {
  return (
    row.details?.geocodeStatus === GeocodeStatus.PENDING ||
    isGeocodingRow(row)
  )
}

/**
 * Ключ строки. Строки каркаса загрузки — пустышки без участка, поэтому лезть
 * в `branch` напрямую нельзя: таблица зовёт ключ и для них, и страница падала
 * целиком (белый экран на «Пунктах выдачи», 14.09.2026).
 */
function pointRowKey(row: IssuancePointRow): string {
  return row.branch?.braname ?? ''
}

const columns: BaseTableColumn<IssuancePointRow>[] = [
  { key: 'ku', label: t('marketplace.issuancePoints.column.branch'), width: '240px', sortable: true, field: (row) => branchName(row) },
  { key: 'city', label: t('marketplace.issuancePoints.column.city'), width: '140px', sortable: true, field: (row) => row.branch.city ?? '' },
  { key: 'address', label: t('marketplace.issuancePoints.column.address'), width: '300px', field: (row) => addressOf(row) },
  { key: 'status', label: t('marketplace.issuancePoints.column.status'), width: '160px', sortable: true, field: (row) => statusOf(row).label },
  { key: 'geo', label: t('marketplace.issuancePoints.column.geocode'), width: '190px' },
  { key: 'initiator', label: t('marketplace.issuancePoints.column.initiator'), width: '220px' },
  { key: 'actions', label: t('marketplace.issuancePoints.column.actions'), width: '200px' },
]

// ─── Инициатор участка ───

/** Инициаторы по участкам; строки без ответа узла — председатель участка. */
const initiators = ref<Record<string, MarketplaceBranchInitiatorView>>({})
const initiatorDialogOpen = ref(false)
const initiatorRow = ref<IssuancePointRow | null>(null)
const initiatorDraft = ref<string | null>(null)
const initiatorSaving = ref(false)

/** Пустой выбор — доля достаётся председателю участка. */
const CHAIRMAN_OPTION = ''

function memberName(p: { first_name?: string | null; last_name?: string | null; middle_name?: string | null; username: string } | null | undefined): string {
  if (!p) return ''
  const full = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(' ').trim()
  return full || p.username
}

function initiatorLabel(row: IssuancePointRow): string {
  const info = initiators.value[row.branch.braname]
  if (!info?.username) return '—'
  const members = [row.branch.trustee, ...(row.branch.trusted ?? [])]
  const person = members.find((m) => m?.username === info.username)
  return person ? memberName(person) : info.username
}

function initiatorAssigned(row: IssuancePointRow): boolean {
  return Boolean(initiators.value[row.branch.braname]?.assigned)
}

const initiatorOptions = computed(() => {
  const b = initiatorRow.value?.branch
  if (!b) return []
  const members = [b.trustee, ...(b.trusted ?? [])].filter((m): m is NonNullable<typeof m> => Boolean(m))
  return [
    { value: CHAIRMAN_OPTION, label: t('marketplace.issuancePoints.initiatorChairmanOption') },
    ...members
      .filter((m) => m.username !== b.trustee?.username)
      .map((m) => ({ value: m.username, label: memberName(m) })),
  ]
})

async function loadInitiators(): Promise<void> {
  const result: Record<string, MarketplaceBranchInitiatorView> = {}
  await Promise.all(
    branchStore.branches.map(async (b) => {
      try {
        result[b.braname] = await getBranchInitiator(b.braname)
      } catch {
        // Участок без ответа остаётся без подписи инициатора — доля у председателя.
      }
    }),
  )
  initiators.value = result
}

function openInitiator(row: IssuancePointRow): void {
  initiatorRow.value = row
  const info = initiators.value[row.branch.braname]
  initiatorDraft.value = info?.assigned && info.username ? info.username : CHAIRMAN_OPTION
  initiatorDialogOpen.value = true
}

async function onSaveInitiator(): Promise<void> {
  const row = initiatorRow.value
  if (!row) return
  initiatorSaving.value = true
  try {
    const saved = await setBranchInitiator({
      braname: row.branch.braname,
      username: initiatorDraft.value ? initiatorDraft.value : null,
    })
    initiators.value = { ...initiators.value, [row.branch.braname]: saved }
    SuccessAlert(t('marketplace.issuancePoints.initiatorSavedSuccess'))
    initiatorDialogOpen.value = false
  } catch (e) {
    FailAlert(e, t('marketplace.issuancePoints.initiatorSaveFailedError'))
  } finally {
    initiatorSaving.value = false
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    await Promise.all([
      branchStore.loadBranches({ coopname: coopname.value }),
      kuStore.load({ coopname: coopname.value, onlyActive: false }),
    ])
    await loadInitiators()
  } catch (e) {
    FailAlert(e, t('marketplace.issuancePoints.loadFailedError'))
  } finally {
    loading.value = false
  }
}

// Геокодер на бэкенде fire-and-forget: статус PENDING → OK/FAILED приходит
// по ленте изменений (marketplace_ku_details), перечитываем тихо, без спиннера.
async function reloadKuDetails(): Promise<void> {
  try {
    await kuStore.load({ coopname: coopname.value, onlyActive: false })
  } catch {
    // Тихое обновление не спамит FailAlert — следующий сигнал ленты подхватит.
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
    SuccessAlert(status === KuDetailsStatus.ACTIVE ? t('marketplace.issuancePoints.activatedSuccess') : t('marketplace.issuancePoints.deactivatedSuccess'))
  } catch (e) {
    FailAlert(e, t('marketplace.issuancePoints.toggleFailedError'))
  }
}

async function retryGeocode(row: IssuancePointRow): Promise<void> {
  geocodingBranames.value = new Set(geocodingBranames.value).add(row.branch.braname)
  try {
    const updated = await kuStore.retryGeocode(coopname.value, row.branch.braname)
    if (updated.geocodeStatus === GeocodeStatus.OK) {
      SuccessAlert(t('marketplace.issuancePoints.geocodedSuccess'))
    } else if (updated.geocodeStatus === GeocodeStatus.FAILED) {
      FailAlert(
        new Error(updated.geocodeErrorMessage || t('marketplace.issuancePoints.geocodeFailedError')),
      )
    } else {
      SuccessAlert(t('marketplace.issuancePoints.geocodingStartedInfo'))
    }
  } catch (e) {
    FailAlert(e, t('marketplace.issuancePoints.geocodeRetryFailedError'))
  } finally {
    const next = new Set(geocodingBranames.value)
    next.delete(row.branch.braname)
    geocodingBranames.value = next
  }
}

useLiveReload(marketLiveTables('ku'), reloadKuDetails);

onMounted(() => {
  void load()
})
</script>

<template lang="pug">
q-page.admin-pvz
  PageHint(storage-key='mp:admin-pvz:banner-dismissed')
    | {{ $t('marketplace.adminIssuancePoints.intro') }}

  .admin-pvz__toolbar
    .admin-pvz__counter(v-if='!firstLoad && rows.length')
      | {{ $t('marketplace.issuancePoints.connectedSummary', { connected: connectedCount, total: rows.length }) }}

  BaseTable(
    v-if='loading || rows.length',
    :columns='columns',
    :rows='rows',
    :row-key='pointRowKey',
    hover,
    :loading='loading',
    min-width='1450px',
    sort-by='ku'
  )
    template(#cell-ku='{ row }')
      IdentityCell(
        :account-name='row.branch.braname',
        :full-name='branchName(row)'
      )
    template(#cell-city='{ row }')
      | {{ row.branch.city || '—' }}
    template(#cell-address='{ row }')
      .admin-pvz__address {{ addressOf(row) }}
    template(#cell-status='{ row }')
      BaseBadge(:variant='statusOf(row).variant') {{ statusOf(row).label }}
    template(#cell-geo='{ row }')
      .admin-pvz__geo(v-if='row.details')
        BaseBadge.admin-pvz__geo-badge(
          :variant='GEOCODE_LABEL[row.details.geocodeStatus].variant'
        )
          q-spinner.admin-pvz__geo-spinner(
            v-if='isGeocodePending(row)',
            color='inherit',
            size='14px'
          )
          span {{ GEOCODE_LABEL[row.details.geocodeStatus].label }}
          q-tooltip(
            v-if='row.details.geocodeStatus === GeocodeStatus.FAILED && row.details.geocodeErrorMessage'
          ) {{ row.details.geocodeErrorMessage }}
        BaseButton(
          v-if='hasCoords(row)',
          variant='ghost',
          icon-only,
          size='sm',
          :aria-label='$t("marketplace.issuancePoints.openMapAriaLabel")',
          @click='openMap(row)'
        )
          template(#icon-left)
            q-icon(name='map', size='18px')
      span.admin-pvz__dash(v-else) —
    //- Получатель доли инициатора: председатель участка, если не назначен другой.
    template(#cell-initiator='{ row }')
      .admin-pvz__initiator
        span {{ initiatorLabel(row) }}
        BaseBadge(v-if='initiatorAssigned(row)', variant='info') {{ $t('marketplace.issuancePoints.initiatorAssignedBadge') }}
        BaseButton(
          v-if='isChairman',
          variant='ghost',
          icon-only,
          size='sm',
          :aria-label='$t("marketplace.issuancePoints.initiatorEditAriaLabel")',
          @click='openInitiator(row)'
        )
          template(#icon-left)
            q-icon(name='edit', size='18px')
    template(#cell-actions='{ row }')
      template(v-if='isChairman')
        BaseButton(
          v-if='!row.details',
          variant='primary',
          size='sm',
          @click='openAdd(row.branch)'
        )
          template(#icon-left)
            q-icon(name='add_location_alt', size='16px')
          | {{ $t('marketplace.issuancePoints.makeIssuancePointButton') }}
        .admin-pvz__actions(v-else)
          BaseButton(
            variant='ghost',
            icon-only,
            size='sm',
            :aria-label='$t("marketplace.issuancePoints.editAriaLabel")',
            @click='openEdit(row)'
          )
            template(#icon-left)
              q-icon(name='edit', size='18px')
          BaseButton(
            v-if='row.details.geocodeStatus !== GeocodeStatus.OK',
            variant='ghost',
            icon-only,
            size='sm',
            :aria-label='$t("marketplace.issuancePoints.geocodeAriaLabel")',
            :loading='isGeocodingRow(row)',
            :disabled='isGeocodingRow(row)',
            @click='retryGeocode(row)'
          )
            template(#icon-left)
              q-icon(name='my_location', size='18px')
          BaseButton(
            v-if='row.details.status === KuDetailsStatus.ACTIVE',
            variant='ghost',
            icon-only,
            size='sm',
            :aria-label='$t("marketplace.issuancePoints.deactivateAriaLabel")',
            @click='setStatus(row, KuDetailsStatus.INACTIVE)'
          )
            template(#icon-left)
              q-icon(name='block', size='18px')
          BaseButton(
            v-else,
            variant='ghost',
            icon-only,
            size='sm',
            :aria-label='$t("marketplace.issuancePoints.activateAriaLabel")',
            @click='setStatus(row, KuDetailsStatus.ACTIVE)'
          )
            template(#icon-left)
              q-icon(name='check_circle', size='18px')
      span.admin-pvz__dash(v-else) —

  EmptyState(
    v-else,
    :title='$t("marketplace.issuancePoints.emptyTitle")',
    :body='$t("marketplace.issuancePoints.emptyBody")'
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

  //- Назначение инициатора участка: получатель доли экономии месяца.
  BaseDialog(v-model='initiatorDialogOpen', :title='$t("marketplace.issuancePoints.initiatorDialogTitle")', size='sm')
    .admin-pvz__dialog-body
      p {{ $t('marketplace.issuancePoints.initiatorDialogHint') }}
      BaseSelect(
        v-model='initiatorDraft',
        :label='$t("marketplace.issuancePoints.column.initiator")',
        :options='initiatorOptions'
      )
    template(#footer)
      BaseButton(variant='ghost', :disabled='initiatorSaving', @click='initiatorDialogOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='initiatorSaving', @click='onSaveInitiator') {{ $t('common.action.save') }}

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

  &__geo-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__geo-spinner {
    flex-shrink: 0;
  }

  &__map-addr {
    color: var(--p-ink-2);
    margin-bottom: var(--p-3, 12px);
  }

  &__initiator {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    flex-wrap: wrap;
  }

  &__dialog-body {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    color: var(--p-ink-2);
  }
}

.table-scroll {
  overflow-x: auto;
}

// Глобальный канон (.table{min-width:0!important}) снимает локальный min-width —
// без !important колонки схлопываются и наезжают друг на друга. Сумма ширин =
// min-width: при нехватке места скролл в .table-scroll, не сжатие.
.table {
  table-layout: fixed !important;
  min-width: 1140px !important;
}

.col-ku {
  width: 220px;
}
.col-city {
  width: 120px;
}
.col-address {
  width: 280px;
  overflow-wrap: anywhere;
}
.col-status {
  width: 150px;
  white-space: nowrap;
}
.col-geo {
  width: 180px;
}
.col-action {
  width: 190px;
  text-align: right;
}

@media (max-width: 768px) {
  .admin-pvz {
    padding: var(--p-4, 16px);
  }
}
</style>
