<template lang="pug">
//- Подписки кооператива у провайдера подключения — только для чтения.
//- Зоны сверху вниз: кошелёк у оператора (сколько есть) → счёт (сколько и
//- когда спишется) → подписки (за что). Пополнение и смена тарифа остаются
//- на столе пайщика у оператора — об этом говорит одна строка под счётом.
.node-subs
  BaseBanner(v-if='error', variant='neg') {{ $t('nodeSubscriptions.loadError', { error }) }}
    template(#action)
      BaseButton(variant='secondary', size='sm', type='button', @click='load') {{ $t('common.action.retry') }}

  EmptyState(
    v-else-if='!firstLoad && billing && !billing.available',
    :title="$t('nodeSubscriptions.unavailableTitle')",
    :body="$t('nodeSubscriptions.unavailableBody')"
  )
    template(#icon)
      q-icon(name='hub', size='28px')

  template(v-else)
    .node-subs__wallets.row.q-col-gutter-md
      .col-12.col-md-6
        WalletCard(
          program='wallet',
          :title="$t('nodeSubscriptions.wallet.title')",
          :subtitle='walletSubtitle',
          :balance='membership.amount',
          :symbol='membership.symbol || symbol',
          :loading='firstLoad'
        )
      .col-12.col-md-6
        WalletCard(
          neutral,
          icon='bolt',
          title='AXON',
          :subtitle="$t('nodeSubscriptions.wallet.axonSubtitle')",
          :balance='axon.amount',
          :symbol='axon.symbol || "AXON"',
          :loading='firstLoad'
        )

    BaseCard(:title="$t('nodeSubscriptions.bill.title')")
      .node-subs__rows
        DataRow(:label="$t('nodeSubscriptions.bill.monthly')", :value='formatPrice(billing?.monthlyTotal ?? 0)', align='spread', mono)
        DataRow(:label="$t('nodeSubscriptions.bill.due')", :value='formatPrice(billing?.dueAmount ?? 0)', align='spread', mono)
        DataRow(:label="$t('nodeSubscriptions.bill.nextCharge')", :value='formatDay(billing?.nextPaymentDue)', align='spread')
      p.node-subs__note {{ $t('nodeSubscriptions.bill.note', { operator: operatorLabel }) }}

    BaseTable(
      :columns='columns',
      :rows='rows',
      row-key='id',
      :loading='firstLoad',
      :skeleton-rows='3',
      min-width='520px'
    )
      template(#cell-name='{ row }')
        .node-subs__name {{ row.name }}
        .node-subs__meta.t-mono(v-if='row.packageId') {{ row.packageId }}
      template(#cell-status='{ row }')
        BaseBadge(:variant='subscriptionStatusVariant(row.status)') {{ subscriptionStatusLabel(row.status) }}
        .node-subs__meta {{ periodLine(row) }}
      template(#cell-price='{ row }')
        .node-subs__price.t-mono.t-num {{ formatPrice(row.price) }}
        .node-subs__meta {{ row.periodDays > 31 ? $t('nodeSubscriptions.table.perYear') : $t('nodeSubscriptions.table.perMonth') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import type { Queries } from '@coopenomics/sdk';
import { BaseBadge, BaseBanner, BaseButton, BaseCard, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, WalletCard } from 'src/shared/ui/domain';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useSystemStore } from 'src/entities/System/model';
import { api as extensionApi } from 'src/entities/Extension/api';
import { subscriptionStatusLabel, subscriptionStatusVariant } from 'src/entities/Union';
import { formatAsset2Digits, splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone';
import { t } from 'src/shared/i18n';

type NodeBilling = Queries.Extensions.AppsNodeBilling.IOutput[typeof Queries.Extensions.AppsNodeBilling.name];
type NodeSubscription = NodeBilling['subscriptions'][number];

const { info } = useSystemStore();

const billing = ref<NodeBilling | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const firstLoad = useFirstLoad(loading);

// realtime: нет источника — подписки ведёт провайдер подключения (другой узел), в ленте кооператива их нет.
async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    billing.value = await extensionApi.loadAppsNodeBilling();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const symbol = computed(() => info.symbols?.root_govern_symbol || 'RUB');

const membership = computed(() => splitAsset2Digits(billing.value?.wallet?.membershipAvailable || `0 ${symbol.value}`));
const axon = computed(() => splitAsset2Digits(billing.value?.wallet?.axonAvailable || '0 AXON'));

const operatorLabel = computed(() => billing.value?.operator || t('nodeSubscriptions.operatorFallback'));
const walletSubtitle = computed(() => t('nodeSubscriptions.wallet.subtitle', { operator: operatorLabel.value }));

const rows = computed(() => billing.value?.subscriptions ?? []);

const columns: BaseTableColumn<NodeSubscription>[] = [
  { key: 'name', label: t('nodeSubscriptions.table.subscription') },
  { key: 'status', label: t('nodeSubscriptions.table.status'), width: '170px' },
  { key: 'price', label: t('nodeSubscriptions.table.price'), numeric: true, width: '160px' },
];

const formatPrice = (price: number | string): string => formatAsset2Digits(`${String(price)} ${symbol.value}`);
const formatDay = (iso?: string | null): string => (iso ? formatDateToLocalTimezone(iso, 'DD.MM.YYYY') : '—');

/** Под состоянием — срок: пробный до даты, оплачено по дату, просрочено с даты. */
const periodLine = (row: NodeSubscription): string => {
  if (row.isTrial) return t('nodeSubscriptions.table.trialUntil', { date: formatDay(row.expiresAt) });
  if (String(row.status).toLowerCase() === 'expired') return t('nodeSubscriptions.table.dueSince', { date: formatDay(row.expiresAt) });
  return t('nodeSubscriptions.table.paidUntil', { date: formatDay(row.expiresAt) });
};
</script>

<style scoped lang="scss">
.node-subs {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
.node-subs__wallets > [class^='col'] {
  display: flex;
}
.node-subs__wallets :deep(.wallet) {
  flex: 1;
}
.node-subs__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.node-subs__note {
  margin: var(--p-4) 0 0;
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
  color: var(--p-ink-2);
}
.node-subs__name {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  white-space: normal;
}
.node-subs__meta {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
  margin-top: 2px;
  white-space: normal;
}
.node-subs__price {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
  white-space: nowrap;
}
</style>
