<template lang="pug">
//- Зоны страницы: что это за страница (подсказка) → сколько можно
//- транслировать (личный остаток в Благоросте) → что уже транслировано
//- (история) → кто допущен (только председателю). Действие «Транслировать» —
//- в шапке.
q-page.share-transfer-page
  PageHint(storage-key='capital:share-transfer:banner-dismissed')
    | {{ $t('capital.shareTransfer.hint') }}

  .share-transfer-page__wallet
    WalletCard(
      program='blagorost',
      :title='$t("capital.shareTransfer.walletTitle")',
      :subtitle='$t("capital.shareTransfer.walletSubtitle")',
      :balance-label='$t("capital.shareTransfer.walletBalanceLabel")',
      :balance='balance.amount',
      :symbol='balance.symbol',
      icon='savings',
      :loading='!store.state'
    )

  PageTabs(v-if='isChairman', :tabs='tabs', :active-key='activeTab', @select='(tab) => (activeTab = tab.key)')

  template(v-if='activeTab === "history"')
    BaseTable(
      :columns='columns',
      :rows='rows',
      row-key='_id',
      :loading='firstLoad',
      clickable-rows,
      @row-click='openDetails'
    )
      template(#cell-created_at='{ row }')
        span {{ formatDate(row.created_at) }}
      template(#cell-member='{ row }')
        .member-cell
          .member-cell__name {{ row.display_name }}
          .member-cell__meta {{ row.username }}
      template(#cell-amount='{ row }')
        span.t-mono {{ formatAsset2Digits(row.amount) }}
    EmptyState(
      v-if='!firstLoad && !rows.length',
      :title='$t("capital.shareTransfer.emptyTitle")',
      :body='$t("capital.shareTransfer.emptyBody")'
    )
      template(#icon)
        q-icon(name='move_up', size='48px')

  ShareTransferAccess(v-else-if='isChairman')

  //- Трансляция целиком: сумма крупно, факты строками.
  DetailsDrawer(v-model='detailsOpen', :title='$t("capital.shareTransfer.detailsTitle")', :width='480')
    template(v-if='details')
      .details__amount-label {{ $t('capital.shareTransfer.amountColumn') }}
      .details__amount {{ formatAsset2Digits(details.amount) }}
      DataRow(:label='$t("capital.shareTransfer.dateColumn")', :value='formatDate(details.created_at)', align='spread')
      DataRow(:label='$t("capital.shareTransfer.memberColumn")', :value='details.display_name', align='spread')
      DataRow(:label='$t("capital.shareTransfer.directionLabel")', :value='$t("capital.shareTransfer.directionValue")', align='vertical')
      DataRow(:label='$t("capital.shareTransfer.transactionLabel")', :value='details.transaction_id', mono, copyable, align='vertical')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CapitalContract, Ledger2Contract } from 'cooptypes';
import { useLiveReload, liveTable } from 'src/shared/lib/realtime';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useHeaderActions } from 'src/shared/hooks/useHeaderActions';
import { FailAlert } from 'src/shared/api/alerts';
import { BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { PageTabs } from 'src/shared/ui/layout';
import type { PageTab } from 'src/shared/ui/layout';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useShareTransferStore, type IShareTransfer } from 'app/extensions/capital/entities/ShareTransfer';
import { TransferShareButton } from 'app/extensions/capital/features/ShareTransfer';
import { ShareTransferAccess } from 'app/extensions/capital/widgets/ShareTransferAccess';
import { t } from '../../i18n';

/**
 * Трансляция паевого взноса из Благороста в Цифровой Кошелёк — закрытая
 * страница: её видят председатель и пайщики, которым он выдал доступ.
 * Пайщик видит свой остаток и свою историю; председатель — историю всего
 * кооператива и список допущенных.
 */

const store = useShareTransferStore();
const session = useSessionStore();
const system = useSystemStore();
const desktop = useDesktopStore();
const { registerAction } = useHeaderActions();

// Право на историю всего кооператива есть только у председателя.
const isChairman = computed(() => desktop.hasGrant('capital', 'ShareTransfer:read'));

const activeTab = ref('history');
const tabs = computed<PageTab[]>(() => [
  { key: 'history', label: t('capital.shareTransfer.historyTab'), icon: 'history', count: store.transfers?.totalCount },
  { key: 'access', label: t('capital.shareTransfer.accessTab'), icon: 'admin_panel_settings' },
]);

const balance = computed(() => {
  const symbol = system.info?.symbols?.root_govern_symbol ?? 'RUB';
  const [amount, sym] = formatAsset2Digits(store.state?.blagorost_balance ?? `0 ${symbol}`).split(' ');
  return { amount: amount || '0,00', symbol: sym || symbol };
});

const columns = computed<BaseTableColumn<IShareTransfer>[]>(() => [
  { key: 'created_at', label: t('capital.shareTransfer.dateColumn'), field: 'created_at', width: '180px', nowrap: true },
  ...(isChairman.value ? [{ key: 'member', label: t('capital.shareTransfer.memberColumn'), field: 'display_name' as const }] : []),
  { key: 'amount', label: t('capital.shareTransfer.amountColumn'), field: 'amount', align: 'right' as const, numeric: true, nowrap: true },
]);

const rows = computed(() => store.transfers?.items ?? []);

const loading = ref(true);
const firstLoad = useFirstLoad(loading);

const detailsOpen = ref(false);
const details = ref<IShareTransfer | null>(null);

function openDetails(row: IShareTransfer): void {
  details.value = row;
  detailsOpen.value = true;
}

function formatDate(value: string | Date): string {
  return formatDateToLocalTimezone(value, 'DD.MM.YYYY HH:mm');
}

async function load(): Promise<void> {
  try {
    await Promise.all([
      store.loadState(session.username),
      store.loadTransfers(isChairman.value ? undefined : session.username),
    ]);
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
}

// Остаток и история живут по ленте: трансляция меняет кошелёк пайщика в цепи
// и добавляет строку истории в базе узла.
useLiveReload(
  [
    liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
    { code: CapitalContract.contractName.production, table: 'capital_share_transfers' },
  ],
  load,
);

onMounted(() => {
  registerAction({ id: 'capital-share-transfer', component: TransferShareButton, order: 1 });
  void load();
});
</script>

<style lang="scss" scoped>
.share-transfer-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding: var(--p-6);

  @media (max-width: 768px) {
    padding: var(--p-4);
  }
}

.share-transfer-page__wallet {
  max-width: 520px;
}

.member-cell__name {
  font-weight: 600;
}

.member-cell__meta {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}

.details__amount-label {
  color: var(--p-ink-3);
  font-size: var(--p-fs-eyebrow);
  text-transform: uppercase;
}

.details__amount {
  margin-bottom: var(--p-4);
  font-size: var(--p-fs-h2);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
