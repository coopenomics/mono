<template lang="pug">
//- Зоны строки: опознание (пакет, действующая версия) → издатель → деньги
//- (цена издателя, только показ) → действие. Строка открывает панель пакета:
//- издатели и снятие издателя.
q-page(padding)
  .q-pa-md
    PageHint.q-mb-md(storage-key='developer:admin-packages:hint-dismissed')
      | {{ $t('developer.adminPackages.intro') }}

    BaseBanner.q-mb-md(v-if='error', variant='neg') {{ error }}

    EmptyState(
      v-else-if='!firstLoad && !rows.length',
      :title="$t('developer.adminPackages.emptyTitle')",
      :body="$t('developer.adminPackages.emptyBody')"
    )
      template(#icon)
        q-icon(name='inventory_2', size='28px')

    BaseTable(
      v-else,
      :columns='columns',
      :rows='rows',
      row-key='packageId',
      :loading='firstLoad',
      :skeleton-rows='4',
      min-width='760px',
      clickable-rows,
      @row-click='openPackage'
    )
      template(#cell-package='{ row }')
        .t-mono {{ row.packageId }}
        .t-sm.t-muted {{ versionNote(row) }}
      template(#cell-publisher='{ row }')
        BaseBadge(v-if='!row.publishers.length', variant='warn') {{ $t('developer.adminPackages.noPublisher') }}
        template(v-else)
          .t-mono(v-for='p in row.publishers', :key='p.username') {{ p.username }}
      template(#cell-price='{ row }')
        template(v-if='hasPrice(row)')
          .admin-packages__amount {{ priceLabel(row) }}
          .t-sm.t-muted {{ trialLabel(row) }}
        span.t-muted(v-else) {{ $t('developer.adminPackages.priceNotSet') }}
      template(#cell-actions='{ row }')
        BaseButton(variant='secondary', size='sm', @click.stop='openAssign(row)') {{ $t('developer.adminPackages.assign') }}

  DetailsDrawer(v-model='drawerOpen', :title="current ? current.packageId : ''", :width='480')
    template(v-if='current')
      .admin-packages__section
        DataRow(align='spread', :label="$t('developer.adminPackages.versionLabel')", :value='versionNote(current)')
        DataRow(
          align='spread',
          :label="$t('developer.price.priceLabel')",
          :value="hasPrice(current) ? priceLabel(current) : $t('developer.adminPackages.priceNotSet')"
        )
        DataRow(v-if='hasPrice(current)', align='spread', :label="$t('developer.price.trialTitle')", :value='trialValue(current)')
        .t-sm.t-muted.q-mt-sm {{ $t('developer.adminPackages.priceReadonly') }}

      .admin-packages__section
        .admin-packages__section-head
          .admin-packages__section-title {{ $t('developer.adminPackages.publishersTitle') }}
          BaseButton(variant='secondary', size='sm', @click='openAssign(current)') {{ $t('developer.adminPackages.assign') }}
        .t-sm.t-muted(v-if='!current.publishers.length') {{ $t('developer.adminPackages.noPublisherText') }}
        .admin-packages__publisher(v-for='p in current.publishers', :key='p.username')
          .admin-packages__publisher-main
            .t-mono {{ p.username }}
            .t-sm.t-muted {{ assignedNote(p) }}
          BaseButton(variant='danger', size='sm', :loading='isSubmitting', @click='removePublisher(p)')
            | {{ $t('developer.adminPackages.remove') }}

  BaseDialog(v-model='assignDialog', :title="$t('developer.adminPackages.assignTitle')", size='md')
    p.t-sm.t-muted.q-mb-sm
      | {{ $t('developer.adminPackages.assignText') }}
      |
      span.t-mono {{ assignPackageId }}
    UserSearchSelector(
      v-model='assignUsername',
      :label="$t('developer.adminPackages.memberLabel')",
      :exclude='assignExclude',
      outlined
    )
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg') {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='assignDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='isSubmitting', :disabled='!assignUsername', @click='confirmAssign')
        | {{ $t('developer.adminPackages.assignSubmit') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { BaseBadge, BaseBanner, BaseButton, BaseDialog, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable/BaseTable.types';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { UserSearchSelector } from 'src/shared/ui';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { useAppsPublishers, type IAppsPublisher } from '../features/AppsPublishers/model';
import { api as pricingApi, type IPackagePricing } from '../features/PackagePricing/api';
import { formatDate, formatRub } from '../shared/lib/format';
import { t } from '../i18n';

/**
 * «Пакеты и издатели» стола администратора: все пакеты кооператива в каталоге
 * и пакеты, которые пайщики зарегистрировали на себя. Администратор назначает
 * и снимает издателей; цену видит, но не меняет — её назначает издатель.
 */
interface AdminPackage {
  packageId: string;
  /** Цена из каталога; `null` — пакет зарегистрирован, выпуска ещё не было. */
  pricing: IPackagePricing | null;
  publishers: IAppsPublisher[];
}

const { confirm } = useConfirm();
const { items: publishers, error: publishersError, isSubmitting, actionError, load: loadPublishers, add, remove } =
  useAppsPublishers();
const pricing = ref<IPackagePricing[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const error = ref<string | null>(null);
const firstLoad = useFirstLoad(loading);

/** Пакеты каталога и зарегистрированные пакеты без выпуска — одним списком по имени. */
const rows = computed<AdminPackage[]>(() => {
  const ids = new Set([...pricing.value.map((p) => p.packageId), ...publishers.value.map((p) => p.packageId)]);
  return [...ids].sort().map((packageId) => ({
    packageId,
    pricing: pricing.value.find((p) => p.packageId === packageId) ?? null,
    publishers: publishers.value.filter((p) => p.packageId === packageId),
  }));
});

const columns: BaseTableColumn<AdminPackage>[] = [
  { key: 'package', label: t('developer.column.package') },
  { key: 'publisher', label: t('developer.column.publisher'), width: '200px' },
  { key: 'price', label: t('developer.column.price'), width: '180px' },
  { key: 'actions', label: t('developer.column.actions'), width: '200px', align: 'right', nowrap: true },
];

function versionNote(row: AdminPackage): string {
  if (!row.pricing) return t('developer.adminPackages.noRelease');
  const version = row.pricing.lastActiveVersion;
  return version ? t('developer.stage.activeNote', { version }) : t('developer.adminPackages.noActiveRelease');
}

function hasPrice(row: AdminPackage): boolean {
  return row.pricing?.rubPerMonth != null;
}

function priceLabel(row: AdminPackage): string {
  const rub = row.pricing?.rubPerMonth ?? 0;
  return rub === 0 ? t('developer.price.free') : t('developer.perMonth', { amount: formatRub(rub) });
}

function trialLabel(row: AdminPackage): string {
  const days = row.pricing?.trialDays ?? 0;
  return days > 0 ? t('developer.price.trialDays', { days }) : t('developer.price.noTrial');
}

/** Пробный срок значением строки «подпись — значение»: без повтора подписи. */
function trialValue(row: AdminPackage): string {
  const days = row.pricing?.trialDays ?? 0;
  return days > 0 ? t('developer.price.days', { days }) : t('developer.price.none');
}

/** Кто и когда назначил издателя: сам пайщик при регистрации либо администратор. */
function assignedNote(p: IAppsPublisher): string {
  const date = formatDate(p.createdAt);
  return p.addedBy === p.username
    ? t('developer.adminPackages.selfRegistered', { date })
    : t('developer.adminPackages.assignedBy', { date, username: p.addedBy });
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    [pricing.value] = await Promise.all([pricingApi.listPricing(), loadPublishers()]);
    error.value = publishersError.value;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

// ── Панель пакета ──────────────────────────────────────────────────────────
const drawerOpen = ref(false);
/** Пакет в панели — по идентификатору: после действия панель показывает свежее. */
const currentId = ref<string | null>(null);
const current = computed(() => rows.value.find((r) => r.packageId === currentId.value) ?? null);

function openPackage(row: AdminPackage) {
  currentId.value = row.packageId;
  drawerOpen.value = true;
}

// ── Издатели ───────────────────────────────────────────────────────────────
const assignDialog = ref(false);
const assignPackageId = ref('');
const assignUsername = ref<string | undefined>();
const assignExclude = computed(() =>
  publishers.value.filter((p) => p.packageId === assignPackageId.value).map((p) => p.username),
);

function openAssign(row: AdminPackage) {
  assignPackageId.value = row.packageId;
  assignUsername.value = undefined;
  actionError.value = null;
  assignDialog.value = true;
}

async function confirmAssign() {
  if (!assignUsername.value) return;
  if (await add({ username: assignUsername.value, packageId: assignPackageId.value })) assignDialog.value = false;
}

async function removePublisher(p: IAppsPublisher) {
  const agreed = await confirm({
    title: t('developer.adminPackages.removeTitle'),
    message: t('developer.adminPackages.removeText', { username: p.username, packageId: p.packageId }),
    confirmLabel: t('developer.adminPackages.remove'),
    danger: true,
  });
  if (agreed) await remove({ username: p.username, packageId: p.packageId });
}

// realtime: нет источника — пакеты и цены хранит внешний каталог приложений, назначения издателей — база кооператива вне ленты цепи; список перечитывается после каждого действия на странице.
onMounted(load);
</script>

<style scoped>
.admin-packages__amount {
  font-weight: 600;
}
.admin-packages__section {
  padding: var(--p-4) 0;
  border-top: 1px solid var(--p-line);
}
.admin-packages__section:first-child {
  padding-top: 0;
  border-top: 0;
}
.admin-packages__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  margin-bottom: var(--p-2);
}
.admin-packages__section-title {
  font-size: var(--p-fs-body);
  font-weight: 600;
}
.admin-packages__publisher {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-2) 0;
}
.admin-packages__publisher-main {
  flex: 1;
  min-width: 0;
}
</style>
