<template lang="pug">
//- Под карточками кошельков (решение владельца 04.11.2026). Зоны сверху вниз:
//- «В работе» — что ещё не исполнено: заявки до решения совета, выплаты у
//- кассира, неоплаченные пополнения; «Движения» — история по всем кошелькам
//- пайщика, отбор по одному — нажатием на его карточку выше. Строка открывает
//- справа карточку процесса: документы, операции и проводки.
.wallet-activity
  section.wallet-activity__section(v-if='pending.length')
    .wallet-activity__title {{ $t('wallet.walletActivity.pendingTitle') }}
    BaseTable(
      :columns='pendingColumns',
      :rows='pending',
      row-key='hash',
      min-width='640px',
      clickable-rows,
      @row-click='openPending'
    )
      template(#cell-created='{ row }')
        span.t-mono {{ formatDateToLocalTimezone(row.created_at, 'DD.MM.YYYY HH:mm') }}
      template(#cell-quantity='{ row }')
        span.t-mono {{ formatAsset2Digits(row.quantity) }}
      template(#cell-destination='{ row }')
        | {{ destinationOf(row.payment_method_id) }}
      template(#cell-state='{ row }')
        BaseBadge(:variant='STATE_VARIANTS[row.state]') {{ $t(`wallet.walletActivity.state.${row.state}`) }}

  section.wallet-activity__section
    .wallet-activity__head
      .wallet-activity__title {{ $t('wallet.walletActivity.movementsTitle') }}
      .wallet-activity__filter(v-if='walletMovementsFilter')
        span.t-muted {{ $t('wallet.walletActivity.filterActive', { wallet: filterTitle }) }}
        BaseButton(variant='secondary', size='sm', @click='clearFilter')
          template(#icon-left)
            q-icon(name='close', size='16px')
          | {{ $t('wallet.walletActivity.filterReset') }}

    BaseTable(
      v-if='firstLoad || movements.length',
      :columns='movementColumns',
      :rows='movements',
      row-key='global_sequence',
      :loading='firstLoad',
      min-width='640px',
      :clickable-rows='hasProcess',
      @row-click='openMovement'
    )
      template(#cell-created='{ row }')
        span.t-mono {{ formatDateToLocalTimezone(row.created_at, 'DD.MM.YYYY HH:mm') }}
      template(#cell-operation='{ row }')
        .wallet-activity__operation
          span {{ row.operation_name }}
          span.wallet-activity__meta(v-if='row.wallet_title') {{ row.wallet_title }}
      template(#cell-quantity='{ row }')
        span.t-mono(:class='`wallet-activity__amount--${String(row.direction).toLowerCase()}`') {{ signed(row) }}

    EmptyState(
      v-else,
      :title='$t("wallet.walletActivity.emptyTitle")',
      :body='$t("wallet.walletActivity.emptyBody")'
    )
      template(#icon)
        q-icon(name='receipt_long', size='48px')

    .wallet-activity__more(v-if='hasMore')
      BaseButton(variant='secondary', size='sm', :loading='loading', @click='loadMore') {{ $t('wallet.walletActivity.showMore') }}

  //- Пайщику — сумма, состояние и документы процесса; операции и проводки
  //- учёта на его столе не показываются (решение владельца 04.11.2026).
  DetailsDrawer(v-model='drawerOpen', :title='drawerTitle', :width='520')
    template(v-if='drawer')
      //- Название операции бывает длинным — строкой в теле с переносом, а не в
      //- однострочной шапке панели, где оно обрезалось бы многоточием.
      .wallet-activity__drawer-heading(v-if='drawer.heading') {{ drawer.heading }}
      .wallet-activity__drawer-amount
        .t-muted {{ drawer.amountLabel }}
        .wallet-activity__drawer-sum {{ drawer.amount }}
        BaseBadge.wallet-activity__drawer-badge(v-if='drawer.state', :variant='STATE_VARIANTS[drawer.state]') {{ $t(`wallet.walletActivity.state.${drawer.state}`) }}
      .wallet-activity__drawer-group
        DataRow(align='spread', :label='$t("wallet.walletActivity.column.date")', :value='formatDateToLocalTimezone(drawer.at, "DD.MM.YYYY HH:mm")')
        DataRow(v-if='drawer.wallet', align='vertical', :label='$t("wallet.walletActivity.walletLabel")', :value='drawer.wallet')
        DataRow(v-if='drawer.destination', align='spread', :label='$t("wallet.walletActivity.column.destination")', :value='drawer.destination')
      //- Неоплаченный взнос ещё не дошёл до цепи — процесса нет, документы
      //- появятся после оплаты; карточку процесса не запрашиваем.
      .wallet-activity__drawer-note.t-muted(v-if='!drawer.withProcess') {{ $t('wallet.walletActivity.documentsAfterPayment') }}
      ProcessDetailCard(
        v-else,
        :coopname='info.coopname',
        :process-hash='drawer.hash',
        :process-type='drawer.type',
        documents-only
      )
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Ledger2, Ledger2Contract, SovietContract } from 'cooptypes';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { useFirstLoad } from 'src/shared/lib/composables';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone';
import { BaseBadge, BaseButton, BaseTable, EmptyState, type BaseBadgeVariant, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import {
  loadMyPendingPayouts,
  loadMyWalletMovements,
  paymentMethodLabel,
  useWalletStore,
  walletMovementsFilter,
  type IWalletMovement,
  type IWalletPendingItem,
} from 'src/entities/Wallet';
import { ProcessDetailCard } from 'src/widgets/Process/ProcessDetailCard';
import { t } from 'src/shared/i18n';

const PAGE = 20;

/** Процесс заявки по виду выплаты или платежа — подпись и цвет карточки процесса. */
const PENDING_PROCESS: Partial<Record<string, string>> = {
  [Zeus.PaymentType.WITHDRAWAL]: 'p.wal.wthdrw',
  [Zeus.PaymentType.AID]: 'p.brn.aid',
  [Zeus.PaymentType.DEPOSIT]: 'p.wal.depo',
};

const STATE_VARIANTS: Record<string, BaseBadgeVariant> = {
  [Zeus.WalletPendingState.COUNCIL_REVIEW]: 'info',
  [Zeus.WalletPendingState.AWAITING_CASHIER]: 'warn',
  [Zeus.WalletPendingState.AWAITING_PAYMENT]: 'neutral',
};

const { info } = useSystemStore();
const session = useSessionStore();
const walletStore = useWalletStore();

const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const movements = ref<IWalletMovement[]>([]);
const page = ref(1);
const totalPages = ref(0);
const hasMore = computed(() => page.value < totalPages.value);
const pending = ref<IWalletPendingItem[]>([]);

const filterTitle = computed(() =>
  walletMovementsFilter.value ? (Ledger2.getWalletHumanName(walletMovementsFilter.value) ?? walletMovementsFilter.value) : ''
);

const pendingColumns = computed<BaseTableColumn<IWalletPendingItem>[]>(() => [
  { key: 'created', label: t('wallet.walletActivity.column.date'), width: '160px', nowrap: true },
  { key: 'title', label: t('wallet.walletActivity.column.kind'), field: 'title' },
  { key: 'quantity', label: t('wallet.walletActivity.column.amount'), width: '150px', numeric: true },
  { key: 'destination', label: t('wallet.walletActivity.column.destination'), width: '200px' },
  { key: 'state', label: t('wallet.walletActivity.column.state'), width: '200px', nowrap: true },
]);

const movementColumns = computed<BaseTableColumn<IWalletMovement>[]>(() => [
  { key: 'created', label: t('wallet.walletActivity.column.date'), width: '160px', nowrap: true },
  { key: 'operation', label: t('wallet.walletActivity.column.operation') },
  { key: 'quantity', label: t('wallet.walletActivity.column.amount'), width: '170px', numeric: true },
]);

/** Сумма со знаком относительно кошельков пайщика; перевод и шаг процесса — без знака. */
function signed(row: IWalletMovement): string {
  const amount = formatAsset2Digits(row.quantity);
  if (row.direction === Zeus.WalletMovementDirection.IN) return `+${amount}`;
  if (row.direction === Zeus.WalletMovementDirection.OUT) return `−${amount}`;
  return amount;
}

function destinationOf(methodId: string | null | undefined): string {
  // Идентификатор реквизитов на столе объявлен числом, сервер отдаёт строку.
  const method = methodId ? walletStore.methods.find((m) => String(m.method_id) === methodId) : undefined;
  return method ? paymentMethodLabel(method) : '—';
}

function clearFilter(): void {
  walletMovementsFilter.value = null;
}

function hasProcess(row: IWalletMovement): boolean {
  return Boolean(row.process_hash);
}

// Панель строки: сводка для пайщика и документы процесса по хэшу.
interface DrawerView {
  hash: string;
  type: string;
  title: string;
  heading?: string;
  withProcess: boolean;
  amountLabel: string;
  amount: string;
  at: unknown;
  state?: string;
  wallet?: string | null;
  destination?: string | null;
}
const drawer = ref<DrawerView | null>(null);
const drawerOpen = computed({
  get: () => drawer.value !== null,
  set: (open: boolean) => {
    if (!open) drawer.value = null;
  },
});
const drawerTitle = computed(() => drawer.value?.title ?? '');

function openMovement(row: IWalletMovement): void {
  if (!row.process_hash) return;
  drawer.value = {
    hash: row.process_hash.toLowerCase(),
    type: row.process_type ?? '',
    title: t('wallet.walletActivity.movementDrawerTitle'),
    heading: row.operation_name,
    withProcess: true,
    amountLabel: t('wallet.walletActivity.column.amount'),
    amount: signed(row),
    at: row.created_at,
    wallet: row.wallet_title,
  };
}

function openPending(row: IWalletPendingItem): void {
  drawer.value = {
    hash: row.hash.toLowerCase(),
    type: PENDING_PROCESS[row.type] ?? '',
    title: row.title,
    // Пополнение без оплаты в цепи ещё не отражено — процесса по хэшу нет.
    withProcess: row.state !== Zeus.WalletPendingState.AWAITING_PAYMENT,
    amountLabel: t('wallet.walletActivity.column.amount'),
    amount: formatAsset2Digits(row.quantity),
    at: row.created_at,
    state: row.state,
    destination: destinationOf(row.payment_method_id),
  };
}

async function loadPage(next: number): Promise<void> {
  const username = session.username;
  if (!username) return;
  loading.value = true;
  try {
    const result = await loadMyWalletMovements({
      coopname: info.coopname,
      username,
      wallet_name: walletMovementsFilter.value ?? undefined,
      page: next,
      limit: PAGE,
    });
    movements.value = next === 1 ? result.items : [...movements.value, ...result.items];
    page.value = result.currentPage;
    totalPages.value = result.totalPages;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function loadPending(): Promise<void> {
  const username = session.username;
  if (!username) return;
  try {
    pending.value = await loadMyPendingPayouts({ coopname: info.coopname, username });
  } catch (e) {
    FailAlert(e);
  }
}

async function reload(): Promise<void> {
  await Promise.all([loadPage(1), loadPending()]);
}

function loadMore(): void {
  void loadPage(page.value + 1);
}

watch(walletMovementsFilter, () => void loadPage(1));
watch(() => session.username, (username) => username && void reload(), { immediate: true });

// История живёт по ленте: остатки кошельков пайщика, решения совета, платежи.
useLiveReload(
  [
    liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
    liveTable(SovietContract, SovietContract.Tables.Decisions),
    { code: 'core', table: 'payments' },
  ],
  reload
);
</script>

<style scoped lang="scss">
.wallet-activity {
  display: flex;
  flex-direction: column;
  gap: var(--p-6);
  margin-top: var(--p-6);
}

.wallet-activity__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.wallet-activity__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--p-3);
}

.wallet-activity__filter {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}

.wallet-activity__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}

.wallet-activity__operation {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wallet-activity__meta {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}

.wallet-activity__amount--in {
  color: var(--p-pos);
}

.wallet-activity__amount--out {
  color: var(--p-ink);
}

.wallet-activity__amount--move,
.wallet-activity__amount--process {
  color: var(--p-ink-3);
}

.wallet-activity__drawer-heading {
  margin-bottom: var(--p-4);
  font-size: var(--p-fs-h3);
  font-weight: 600;
  line-height: var(--p-lh-h3);
}
.wallet-activity__drawer-note {
  padding: var(--p-4) 0;
}
.wallet-activity__drawer-amount {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding-bottom: var(--p-4);
  border-bottom: 1px solid var(--p-line);
}

.wallet-activity__drawer-sum {
  font-size: var(--p-fs-h2);
  font-weight: 700;
  color: var(--p-ink);
  font-variant-numeric: tabular-nums;
}

.wallet-activity__drawer-badge {
  align-self: flex-start;
}

.wallet-activity__drawer-group {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding: var(--p-4) 0;
}

.wallet-activity__more {
  display: flex;
  justify-content: center;
}
</style>
