<template lang="pug">
//- Реестр: пакеты сравнивают по колонкам, поэтому таблица. Зоны строки:
//- опознание (пакет, выпуск) → деньги (цена издателя, только показ) →
//- состояние (издатель либо «Не назначен»). Действий в строке нет: строка
//- открывает панель пакета, назначение и снятие издателя — в панели.
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
      q-icon(name='inventory_2', size='32px')

  BaseTable(
    v-else,
    :columns='columns',
    :rows='rows',
    row-key='packageId',
    :loading='firstLoad',
    :skeleton-rows='4',
    min-width='720px',
    clickable-rows,
    @row-click='openPackage'
  )
    template(#cell-package='{ row }')
      .admin-packages__name {{ row.packageId }}
      .t-sm.t-muted {{ versionNote(row) }}
    template(#cell-price='{ row }')
      template(v-if='hasPrice(row)')
        .admin-packages__amount {{ priceLabel(row) }}
        .t-sm.t-muted {{ trialLabel(row) }}
    template(#cell-publisher='{ row }')
      BaseBadge(v-if='!row.publishers.length', variant='warn') {{ $t('developer.adminPackages.noPublisher') }}
      .admin-packages__publishers(v-else)
        IdentityCell(
          v-for='p in row.publishers',
          :key='p.username',
          :account-name='p.username',
          :full-name='accountName(p.username)'
        )

  //- Панель пакета: цена крупно → выпуск → издатели списком. Назначение — в подвале.
  DetailsDrawer(v-model='drawerOpen', :title="current ? current.packageId : ''", :width='520')
    template(v-if='current')
      .admin-packages__head(v-if='!current.publishers.length || hasPrice(current)')
        BaseBadge(v-if='!current.publishers.length', variant='warn') {{ $t('developer.adminPackages.noPublisher') }}
        .admin-packages__price(v-if='hasPrice(current)')
          .admin-packages__price-sum {{ priceLabel(current) }}
          .admin-packages__price-caption {{ trialLabel(current) }}
      //- Линию под последним фактом снимаем: раздел издателей начинается своей линией.
      .admin-packages__facts
        DataRow(align='spread', :label="$t('developer.adminPackages.versionLabel')", :value='versionNote(current)')
        DataRow(
          v-if='!hasPrice(current)',
          align='spread',
          :label="$t('developer.column.price')",
          :value="$t('developer.adminPackages.priceNotSet')",
          :hint="$t('developer.adminPackages.priceReadonly')"
        )

      .admin-packages__section
        .t-eyebrow.q-mb-sm {{ $t('developer.adminPackages.publishersTitle') }}
        q-list(v-if='current.publishers.length', separator)
          q-item.admin-packages__publisher(v-for='p in current.publishers', :key='p.username')
            q-item-section
              IdentityCell(:account-name='p.username', :full-name='accountName(p.username)')
              .t-meta.t-muted {{ assignedNote(p) }}
            q-item-section(side)
              BaseButton(variant='danger', size='sm', :loading='isSubmitting', @click='removePublisher(p)')
                | {{ $t('developer.adminPackages.remove') }}
        .t-sm.t-muted(v-else) {{ $t('developer.adminPackages.noPublisherText') }}

    template(v-if='current', #footer)
      .admin-packages__footer
        q-space
        BaseButton(:variant="current.publishers.length ? 'secondary' : 'primary'", @click='openAssign(current)')
          | {{ $t('developer.adminPackages.assign') }}

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
import { DataRow, DetailsDrawer, IdentityCell, PageHint } from 'src/shared/ui/domain';
import { UserSearchSelector } from 'src/shared/ui';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { useAppsPublishers, type IAppsPublisher } from '../features/AppsPublishers/model';
import { api as pricingApi, type IPackagePricing } from '../features/PackagePricing/api';
import { accountName, resolveAccountNames } from '../shared/lib/accountNames';
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
  { key: 'price', label: t('developer.column.price'), width: '200px' },
  { key: 'publisher', label: t('developer.column.publisher'), width: '280px' },
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
    void resolveAccountNames(publishers.value.map((p) => p.username));
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
  if (!(await add({ username: assignUsername.value, packageId: assignPackageId.value }))) return;
  assignDialog.value = false;
  void resolveAccountNames(publishers.value.map((p) => p.username));
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
.admin-packages__name {
  font-family: var(--p-mono);
  font-weight: 600;
}
.admin-packages__amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.admin-packages__publishers {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.admin-packages__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-3);
  margin-bottom: var(--p-3);
}
.admin-packages__price-sum {
  font-size: var(--p-fs-h1);
  font-weight: 700;
  line-height: var(--p-lh-h1);
  font-variant-numeric: tabular-nums;
}
.admin-packages__price-caption {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
.admin-packages__facts :deep(.data-row:last-child) {
  border-bottom: 0;
}
.admin-packages__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.admin-packages__publisher {
  padding-left: 0;
  padding-right: 0;
}
.admin-packages__footer {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
}
</style>
