<template lang="pug">
//- Реестр доверенностей кооператива (решение владельца 18.11.2026): строка на
//- доверенность — номер, доверенное лицо, участок, основание, срок, состояние.
//- Строка открывает доверенность целиком в правой панели.
q-page.poa-page
  BaseTable(
    v-if='loading || items.length',
    :columns='columns',
    :rows='items',
    row-key='number',
    hover,
    :loading='loading',
    min-width='880px',
    clickable-rows,
    @row-click='(row) => (selected = row)'
  )
    template(#cell-number='{ row }')
      span.t-mono № {{ row.number }}
    template(#cell-type='{ row }')
      | {{ typeLabel(row.type) }}
    template(#cell-holder='{ row }')
      .poa-page__name {{ row.holder_name }}
      .t-sm.t-muted {{ row.holder }}
    template(#cell-basis='{ row }')
      | {{ basis(row) }}
    template(#cell-term='{ row }')
      | {{ ruDate(row.issued_at) }} — {{ ruDate(row.valid_until) }}
    template(#cell-status='{ row }')
      BaseBadge(:variant='STATUS_VIEW[row.status].variant') {{ STATUS_VIEW[row.status].label }}

  EmptyState(v-else, :title='$t("cooperative.powersOfAttorney.emptyTitle")', :body='$t("cooperative.powersOfAttorney.emptyBody")')
    template(#icon)
      q-icon(name='badge', size='22px')

  TablePager(
    v-if='total > PAGE_SIZE',
    :page='page',
    :rows-per-page='PAGE_SIZE',
    :rows-number='total',
    :label='$t("cooperative.powersOfAttorney.pagerLabel")',
    @update:page='onPage'
  )

  DetailsDrawer(
    :model-value='!!selected',
    :width='640',
    :title='selected ? $t("cooperative.powersOfAttorney.drawerTitle", { number: selected.number }) : ""',
    @update:model-value='(v) => !v && (selected = null)'
  )
    template(v-if='selected')
      .poa-page__drawer-head
        BaseBadge(:variant='STATUS_VIEW[selected.status].variant') {{ STATUS_VIEW[selected.status].label }}
      DataRow(:label='$t("cooperative.powersOfAttorney.column.type")', :value='typeLabel(selected.type)', align='spread')
      DataRow(:label='$t("cooperative.powersOfAttorney.column.holder")', :value='selected.holder_name', align='spread')
      DataRow(:label='$t("cooperative.powersOfAttorney.column.branch")', :value='selected.braname', align='spread')
      DataRow(:label='$t("cooperative.powersOfAttorney.column.basis")', :value='basis(selected)', align='spread')
      DataRow(
        :label='$t("cooperative.powersOfAttorney.column.term")',
        :value='`${ruDate(selected.issued_at)} — ${ruDate(selected.valid_until)}`',
        align='spread'
      )
      .poa-page__document(v-if='selected.document')
        BaseDocument(:document-aggregate='selected.document')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseTable, EmptyState, TablePager, type BaseTableColumn } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain';
import { BaseDocument } from 'src/shared/ui/BaseDocument';
import { useLiveReload } from 'src/shared/lib/realtime';
import { t } from 'src/shared/i18n';
import { loadPowersOfAttorney, POWERS_OF_ATTORNEY_LIVE_TABLES, type IPowerOfAttorney } from './api';

const PAGE_SIZE = 50;

const system = useSystemStore();
const items = ref<IPowerOfAttorney[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const selected = ref<IPowerOfAttorney | null>(null);

const STATUS_VIEW: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  active: { label: t('cooperative.powersOfAttorney.status.active'), variant: 'pos' },
  pending: { label: t('cooperative.powersOfAttorney.status.pending'), variant: 'warn' },
  expired: { label: t('cooperative.powersOfAttorney.status.expired'), variant: 'neg' },
  declined: { label: t('cooperative.powersOfAttorney.status.declined'), variant: 'neutral' },
};

const columns = computed<BaseTableColumn<IPowerOfAttorney>[]>(() => [
  { key: 'number', label: t('cooperative.powersOfAttorney.column.number'), width: '90px', nowrap: true },
  { key: 'type', label: t('cooperative.powersOfAttorney.column.type') },
  { key: 'holder', label: t('cooperative.powersOfAttorney.column.holder') },
  { key: 'braname', label: t('cooperative.powersOfAttorney.column.branch'), field: 'braname', nowrap: true },
  { key: 'basis', label: t('cooperative.powersOfAttorney.column.basis'), nowrap: true },
  { key: 'term', label: t('cooperative.powersOfAttorney.column.term'), nowrap: true },
  { key: 'status', label: t('cooperative.powersOfAttorney.column.status'), width: '220px', nowrap: true },
]);

function typeLabel(type: string): string {
  return type === 'branch_trusted' ? t('cooperative.powersOfAttorney.type.trusted') : t('cooperative.powersOfAttorney.type.trustee');
}

/** ГГГГ-ММ-ДД → ДД.ММ.ГГГГ — общий формат дат стола. */
function ruDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function basis(row: IPowerOfAttorney): string {
  return row.protocol_number
    ? t('cooperative.powersOfAttorney.basisValue', { number: row.protocol_number, date: row.protocol_date })
    : '—';
}

async function load(): Promise<void> {
  try {
    const result = await loadPowersOfAttorney({
      filter: { coopname: system.info.coopname },
      options: { page: page.value, limit: PAGE_SIZE, sortOrder: 'DESC' },
    });
    items.value = result.items;
    total.value = result.totalCount;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onPage(next: number): void {
  page.value = next;
  void load();
}

useLiveReload(POWERS_OF_ATTORNEY_LIVE_TABLES, load);
onMounted(load);
</script>

<style lang="scss" scoped>
.poa-page {
  padding: var(--p-6);
}
.poa-page__name {
  font-weight: 600;
}
.poa-page__drawer-head {
  margin-bottom: var(--p-3);
}
.poa-page__document {
  margin-top: var(--p-4);
}
@media (max-width: 768px) {
  .poa-page {
    padding: var(--p-4);
  }
}
</style>
