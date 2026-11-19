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
import { GeocodeStatus, KuDetailsStatus, formatWorkingHours } from 'src/entities/MarketplaceKUDetails'
import type { IMarketplaceKUDetails } from 'src/entities/MarketplaceKUDetails'
import { BaseBadge, BaseButton, BaseDialog, BaseSelect, EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base'
import { DataRow, DetailsDrawer, IdentityCell, PageHint } from 'src/shared/ui/domain'
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

// ─── Правая панель участка ───
// Карточка в списке краткая: что за участок и в каком он состоянии. Всё
// остальное — карта, контакты, режим работы, инициатор и действия
// председателя — открывается справа по нажатию на карточку.
const selectedBraname = ref<string | null>(null)
const selected = computed<IssuancePointRow | null>(
  () => rows.value.find((r) => r.branch.braname === selectedBraname.value) ?? null,
)
const drawerOpen = computed(() => selected.value !== null)

function openRow(row: IssuancePointRow): void {
  selectedBraname.value = row.branch.braname
}

/** Режим работы строками, дни с одинаковым режимом объединены. */
function scheduleLines(row: IssuancePointRow): string[] {
  return formatWorkingHours(row.details?.workingHours)
}

function hasCoords(row: IssuancePointRow): boolean {
  const d = row.details
  return !!d && d.geocodeStatus === GeocodeStatus.OK && d.lat != null && d.lng != null
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

/** Каркас загрузки повторяет зоны карточки: участок, состояние, действия. */
const skeletonColumns: TableSkeletonColumn[] = [
  { label: t('marketplace.issuancePoints.column.branch') },
  { label: t('marketplace.issuancePoints.column.status') },
  { label: t('marketplace.issuancePoints.column.actions') },
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

  //- Карточка участка: опознание (участок, адрес, инициатор) → состояние
  //- (подключение, координаты) → действия. Действия всегда видны: без таблицы
  //- и горизонтальной прокрутки, на узком экране зоны встают друг под другом.
  TableSkeleton(v-if='firstLoad', :columns='skeletonColumns', :rows='3')
  .admin-pvz__list(v-else-if='rows.length')
    .admin-pvz__card(
      v-for='row in rows',
      :key='row.branch.braname',
      role='button',
      tabindex='0',
      @click='openRow(row)',
      @keydown.enter='openRow(row)'
    )
      .admin-pvz__identity
        IdentityCell(:account-name='row.branch.braname', :full-name='branchName(row)')
        .admin-pvz__meta
          q-icon(name='place', size='16px')
          span {{ [row.branch.city, addressOf(row)].filter((v) => v && v !== '—').join(' · ') || '—' }}
      .admin-pvz__state
        BaseBadge(:variant='statusOf(row).variant') {{ statusOf(row).label }}
        BaseBadge.admin-pvz__geo-badge(v-if='row.details', :variant='GEOCODE_LABEL[row.details.geocodeStatus].variant')
          q-spinner.admin-pvz__geo-spinner(v-if='isGeocodePending(row)', color='inherit', size='14px')
          span {{ GEOCODE_LABEL[row.details.geocodeStatus].label }}
      q-icon.admin-pvz__chevron(name='chevron_right', size='22px')

  EmptyState(
    v-else,
    :title='$t("marketplace.issuancePoints.emptyTitle")',
    :body='$t("marketplace.issuancePoints.emptyBody")'
  )
    template(#icon)
      q-icon(name='pin_drop', size='48px')

  //- Участок целиком: карта, контакты, режим работы, инициатор; действия
  //- председателя — внизу панели.
  DetailsDrawer(
    :model-value='drawerOpen',
    :width='560',
    :title='selected ? branchName(selected) : ""',
    @update:model-value='(v) => !v && (selectedBraname = null)'
  )
    template(v-if='selected')
      .admin-pvz__drawer-head
        BaseBadge(:variant='statusOf(selected).variant') {{ statusOf(selected).label }}
        BaseBadge.admin-pvz__geo-badge(
          v-if='selected.details',
          :variant='GEOCODE_LABEL[selected.details.geocodeStatus].variant'
        )
          q-spinner.admin-pvz__geo-spinner(v-if='isGeocodePending(selected)', color='inherit', size='14px')
          span {{ GEOCODE_LABEL[selected.details.geocodeStatus].label }}
      .admin-pvz__drawer-error(
        v-if='selected.details?.geocodeStatus === GeocodeStatus.FAILED && selected.details.geocodeErrorMessage'
      ) {{ selected.details.geocodeErrorMessage }}
      .admin-pvz__map(v-if='hasCoords(selected)')
        MapView(:long='Number(selected.details?.lng)', :lat='Number(selected.details?.lat)', :caption='branchName(selected)')
      DataRow(:label='$t("marketplace.issuancePoints.column.city")', :value='selected.branch.city || "—"', align='spread')
      DataRow(:label='$t("marketplace.issuancePoints.column.address")', :value='addressOf(selected)', align='vertical')
      DataRow(
        v-if='selected.details?.contactPhone',
        :label='$t("marketplace.issuancePoints.phoneLabel")',
        :value='selected.details.contactPhone',
        align='spread'
      )
      DataRow(
        v-if='selected.details?.contactEmail',
        :label='$t("marketplace.issuancePoints.emailLabel")',
        :value='selected.details.contactEmail',
        align='spread'
      )
      DataRow(v-if='scheduleLines(selected).length', :label='$t("marketplace.workingHours.title")', align='vertical')
        template(#value-override)
          .admin-pvz__schedule
            div(v-for='line in scheduleLines(selected)', :key='line') {{ line }}
      DataRow(
        v-if='selected.details?.description',
        :label='$t("marketplace.issuancePoints.descriptionLabel")',
        :value='selected.details.description',
        align='vertical'
      )
      //- Получатель доли инициатора: председатель участка, если не назначен другой.
      DataRow(:label='$t("marketplace.issuancePoints.column.initiator")', align='spread')
        template(#value-override)
          .admin-pvz__initiator
            span {{ initiatorLabel(selected) }}
            BaseBadge(v-if='initiatorAssigned(selected)', variant='info') {{ $t('marketplace.issuancePoints.initiatorAssignedBadge') }}
    template(v-if='selected && isChairman', #footer)
      .admin-pvz__drawer-actions
        BaseButton(v-if='!selected.details', variant='primary', @click='openAdd(selected.branch)')
          template(#icon-left)
            q-icon(name='add_location_alt', size='16px')
          | {{ $t('marketplace.issuancePoints.makeIssuancePointButton') }}
        template(v-else)
          BaseButton(variant='secondary', @click='openEdit(selected)')
            template(#icon-left)
              q-icon(name='edit', size='16px')
            | {{ $t('marketplace.issuancePoints.editAriaLabel') }}
          BaseButton(
            v-if='selected.details.geocodeStatus !== GeocodeStatus.OK',
            variant='secondary',
            :loading='isGeocodingRow(selected)',
            :disabled='isGeocodingRow(selected)',
            @click='retryGeocode(selected)'
          )
            template(#icon-left)
              q-icon(name='my_location', size='16px')
            | {{ $t('marketplace.issuancePoints.geocodeAriaLabel') }}
          BaseButton(
            v-if='selected.details.status === KuDetailsStatus.ACTIVE',
            variant='secondary',
            @click='setStatus(selected, KuDetailsStatus.INACTIVE)'
          )
            template(#icon-left)
              q-icon(name='block', size='16px')
            | {{ $t('marketplace.issuancePoints.deactivateAriaLabel') }}
          BaseButton(v-else, variant='primary', @click='setStatus(selected, KuDetailsStatus.ACTIVE)')
            template(#icon-left)
              q-icon(name='check_circle', size='16px')
            | {{ $t('marketplace.issuancePoints.activateAriaLabel') }}
        BaseButton(variant='secondary', @click='openInitiator(selected)')
          template(#icon-left)
            q-icon(name='person_pin', size='16px')
          | {{ $t('marketplace.issuancePoints.initiatorDialogTitle') }}

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

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-3);
  }

  /* Зоны: опознание тянется, состояние и действия прижаты вправо. */
  &__card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--p-6);
    padding: var(--p-4) var(--p-5);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-lg);
    background: var(--p-surface);
    cursor: pointer;

    &:hover,
    &:focus-visible {
      background: var(--p-surface-2);
      outline: none;
    }
  }

  &__chevron {
    color: var(--p-ink-3);
  }

  &__drawer-head {
    display: flex;
    gap: var(--p-2);
    flex-wrap: wrap;
    margin-bottom: var(--p-3);
  }

  &__drawer-error {
    color: var(--p-neg);
    font-size: var(--p-fs-body-sm);
    margin-bottom: var(--p-3);
  }

  &__map {
    height: 240px;
    margin-bottom: var(--p-4);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md);
    overflow: hidden;
  }

  &__schedule {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__initiator {
    display: flex;
    align-items: center;
    gap: var(--p-2);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  &__drawer-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2);
  }

  &__identity {
    display: flex;
    flex-direction: column;
    gap: var(--p-1);
    min-width: 0;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: var(--p-2);
    flex-wrap: wrap;
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--p-2);
  }


  &__dash {
    color: var(--p-ink-3);
  }

  &__geo-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__geo-spinner {
    flex-shrink: 0;
  }

  &__dialog-body {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    color: var(--p-ink-2);
  }
}

@media (max-width: 768px) {
  .admin-pvz {
    padding: var(--p-4, 16px);
  }

  /* Узкий экран: зоны друг под другом. */
  .admin-pvz__card {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--p-3);
  }

  .admin-pvz__state {
    flex-direction: row;
    align-items: center;
  }

  .admin-pvz__chevron {
    display: none;
  }
}
</style>
