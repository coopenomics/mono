<template lang="pug">
//- Под карточками кошельков (решение владельца 04.11.2026). Зоны сверху вниз:
//- «В обработке» — что ещё не исполнено: заявки до решения совета, выплаты у
//- кассира, неоплаченные пополнения; «Движения» — история по всем кошелькам
//- пайщика, отбор по одному — нажатием на его карточку выше. Строка открывает
//- справа сумму, ход процесса и реквизиты неоплаченного взноса. Документов
//- процесса в панели нет (решение владельца 05.11.2026): свои документы
//- пайщик смотрит в разделе «Документы», где отбор по владельцу.
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
      template(#cell-title='{ row }')
        .wallet-activity__operation
          span {{ row.title }}
          span.wallet-activity__meta(v-if='orderMeta(row)') {{ orderMeta(row) }}
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
      clickable-rows,
      @row-click='openMovement'
    )
      template(#cell-created='{ row }')
        span.t-mono {{ formatDateToLocalTimezone(row.created_at, 'DD.MM.YYYY HH:mm') }}
      //- Строка — дата, операция и сумма со знаком. Что произошло с деньгами,
      //- откуда и куда они перемещены, — в правой панели по нажатию на строку;
      //- в строке и при наведении подробности не показываются (решение
      //- владельца 06.11.2026).
      template(#cell-operation='{ row }')
        span {{ row.operation_name }}
      template(#cell-quantity='{ row }')
        span.t-mono.wallet-activity__sum(:class='`wallet-activity__amount--${String(row.direction).toLowerCase()}`')
          q-icon(v-if='isMove(row)', name='swap_horiz', size='16px')
          | {{ signed(row) }}

    EmptyState(
      v-else,
      :title='$t("wallet.walletActivity.emptyTitle")',
      :body='$t("wallet.walletActivity.emptyBody")'
    )
      template(#icon)
        q-icon(name='receipt_long', size='48px')

    .wallet-activity__more(v-if='hasMore')
      BaseButton(variant='secondary', size='sm', :loading='loading', @click='loadMore') {{ $t('wallet.walletActivity.showMore') }}

  //- Пайщику — сумма, состояние и ход процесса. Процесс с сервера не
  //- запрашивается: шаги строятся из состояния заявки, поэтому документы одной
  //- стороны процесса не могут открыться другой (решение владельца 05.11.2026).
  DetailsDrawer(v-model='drawerOpen', :title='drawerTitle', :width='520')
    template(v-if='drawer')
      //- Название операции бывает длинным — строкой в теле с переносом, а не в
      //- однострочной шапке панели, где оно обрезалось бы многоточием.
      .wallet-activity__drawer-heading(v-if='drawer.heading') {{ drawer.heading }}
      .wallet-activity__drawer-amount
        .t-muted {{ drawer.amountLabel }}
        .wallet-activity__drawer-sum {{ drawer.amount }}
        .t-muted(v-if='drawer.effect') {{ drawer.effect }}
        BaseBadge.wallet-activity__drawer-badge(v-if='drawer.state', :variant='STATE_VARIANTS[drawer.state]') {{ $t(`wallet.walletActivity.state.${drawer.state}`) }}
      .wallet-activity__drawer-group
        DataRow(align='spread', :label='$t("wallet.walletActivity.column.date")', :value='formatDateToLocalTimezone(drawer.at, "DD.MM.YYYY HH:mm")')
        DataRow(v-if='drawer.meta', align='spread', :label='$t("wallet.walletActivity.orderLabel")', :value='drawer.meta')

        DataRow(v-if='drawer.destination', align='spread', :label='$t("wallet.walletActivity.column.destination")', :value='drawer.destination')
      //- Маршрут движения: две плашки «Откуда» и «Куда» с понятным названием
      //- кошелька, чей он и что в нём лежит (решение владельца 06.11.2026).
      .wallet-activity__route(v-if='drawer.route')
        template(v-for='(end, index) in drawer.route', :key='end.side')
          .wallet-activity__route-arrow(v-if='index > 0')
            q-icon(name='south', size='18px')
          .wallet-activity__route-item
            q-icon.wallet-activity__route-icon(:name='end.icon', size='20px')
            .wallet-activity__route-body
              .wallet-activity__route-label {{ end.side === 'from' ? $t('wallet.walletActivity.fromLabel') : $t('wallet.walletActivity.toLabel') }} · {{ end.owner }}
              .wallet-activity__route-title {{ end.title }}
              .wallet-activity__route-desc {{ end.description }}
      .wallet-activity__drawer-block(v-if='drawer.steps')
        .wallet-activity__drawer-subtitle {{ $t('wallet.walletActivity.stepsTitle') }}
        VerticalStepper(:steps='drawer.steps.items', :active-key='drawer.steps.active', :completed='drawer.steps.completed')
      //- Неоплаченный взнос: те же реквизиты и код для оплаты, что при пополнении.
      .wallet-activity__drawer-block(v-if='drawer.paymentOrder')
        .wallet-activity__drawer-subtitle {{ $t('wallet.walletActivity.payTitle') }}
        PayWithProvider(:payment-order='drawer.paymentOrder')
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
import { DataRow, DetailsDrawer, VerticalStepper } from 'src/shared/ui/domain';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper/VerticalStepper.types';
import { PayWithProvider } from 'src/shared/ui/PayWithProvider';
import { api as paymentApi } from 'src/entities/Payment/api';
import type { IPayment } from 'src/entities/Payment/model';
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
import { t, te } from 'src/shared/i18n';

const PAGE = 20;

/** Шаги процесса заявки по виду платежа — ход процесса без документов. */
const PENDING_STEPS: Partial<Record<string, string[]>> = {
  [Zeus.PaymentType.WITHDRAWAL]: ['submitted', 'council', 'cashier', 'paid'],
  [Zeus.PaymentType.AID]: ['submitted', 'council', 'cashier', 'paid'],
  [Zeus.PaymentType.PAYMENT]: ['accepted', 'cashier', 'paid'],
  [Zeus.PaymentType.DEPOSIT]: ['pay', 'confirm', 'credited'],
};
/** Текущий шаг по состоянию заявки. */
const ACTIVE_STEP: Record<string, string> = {
  [Zeus.WalletPendingState.COUNCIL_REVIEW]: 'council',
  [Zeus.WalletPendingState.AWAITING_CASHIER]: 'cashier',
  [Zeus.WalletPendingState.AWAITING_PAYMENT]: 'pay',
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

/** Сумма со знаком относительно кошельков пайщика; перенос и шаг процесса — без знака. */
function signed(row: IWalletMovement): string {
  const amount = formatAsset2Digits(row.quantity);
  if (row.direction === Zeus.WalletMovementDirection.IN) return `+${amount}`;
  if (row.direction === Zeus.WalletMovementDirection.OUT) return `−${amount}`;
  return amount;
}

function isMove(row: IWalletMovement): boolean {
  return row.direction === Zeus.WalletMovementDirection.MOVE;
}

/** Конец маршрута движения в панели: значок, чей кошелёк, название и пояснение. */
interface RouteEnd {
  side: 'from' | 'to';
  icon: string;
  owner: string;
  title: string;
  description: string;
}

/**
 * Кошелёк по коду: короткое название и пояснение из словаря стола; кошелька
 * нет в словаре — название из реестра учёта. Без кошелька — поступление
 * извне (источник) или передача пайщику за пределы учёта (получатель).
 */
function routeEnd(side: 'from' | 'to', wallet: string | null | undefined): RouteEnd {
  if (!wallet) {
    const key = side === 'from' ? 'external' : 'outside';
    return {
      side,
      icon: side === 'from' ? 'login' : 'logout',
      owner: t('wallet.walletActivity.route.cooperativeBadge'),
      title: t(`wallet.walletActivity.route.${key}Title`),
      description: t(`wallet.walletActivity.route.${key}Description`),
    };
  }
  const member = Ledger2.getWalletKind(wallet) === 'USER_SHARED';
  const key = `wallet.walletActivity.wallets.${wallet.replace(/\./g, '_')}`;
  const known = te(`${key}.title`);
  return {
    side,
    icon: member ? 'account_balance_wallet' : 'account_balance',
    owner: member ? t('wallet.walletActivity.route.memberBadge') : t('wallet.walletActivity.route.cooperativeBadge'),
    title: known ? t(`${key}.title`) : (Ledger2.getWalletHumanName(wallet) ?? wallet),
    description: known ? t(`${key}.description`) : '',
  };
}

function routeOf(row: IWalletMovement): RouteEnd[] {
  const meta = Ledger2.getOperationMeta(row.operation_code);
  if (!meta) return [];
  return [routeEnd('from', meta.wallet_from), routeEnd('to', meta.wallet_to)];
}

/** Подпись под суммой: что произошло с деньгами пайщика. */
function effectOf(row: IWalletMovement): string {
  switch (row.direction) {
    case Zeus.WalletMovementDirection.IN:
      return t('wallet.walletActivity.effect.in');
    case Zeus.WalletMovementDirection.MOVE:
      return t('wallet.walletActivity.effect.move');
    case Zeus.WalletMovementDirection.OUT:
      if (row.to_cooperative) return t('wallet.walletActivity.effect.toCooperative');
      return row.to_title ? t('wallet.walletActivity.effect.out') : t('wallet.walletActivity.effect.payout');
    default:
      return t('wallet.walletActivity.effect.process');
  }
}

function destinationOf(methodId: string | null | undefined): string {
  // Идентификатор реквизитов на столе объявлен числом, сервер отдаёт строку.
  const method = methodId ? walletStore.methods.find((m) => String(m.method_id) === methodId) : undefined;
  return method ? paymentMethodLabel(method) : '—';
}

/** Выплата за имущество идёт по хэшу заказа — номер заказа объясняет, за что она. */
function orderMeta(row: IWalletPendingItem): string {
  return row.type === Zeus.PaymentType.PAYMENT ? t('wallet.walletActivity.orderMeta', { number: row.hash.slice(0, 8) }) : '';
}

function stepsOf(row: IWalletPendingItem): DrawerSteps | undefined {
  const keys = PENDING_STEPS[row.type];
  const active = ACTIVE_STEP[row.state];
  if (!keys || !active || !keys.includes(active)) return undefined;
  const items: StepperStep[] = keys.map((key) => ({ key, label: t(`wallet.walletActivity.step.${key}`) }));
  return { items, active, completed: keys.slice(0, keys.indexOf(active)) };
}

function clearFilter(): void {
  walletMovementsFilter.value = null;
}

// Панель строки: сводка для пайщика, ход процесса, реквизиты неоплаченного взноса.
interface DrawerSteps {
  items: StepperStep[];
  active: string;
  completed: string[];
}
interface DrawerView {
  hash: string;
  title: string;
  heading?: string;
  steps?: DrawerSteps;
  meta?: string;
  paymentOrder?: IPayment | null;
  amountLabel: string;
  amount: string;
  at: unknown;
  state?: string;
  effect?: string;
  route?: RouteEnd[];
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
  drawer.value = {
    hash: (row.process_hash ?? row.global_sequence).toLowerCase(),
    title: t('wallet.walletActivity.movementDrawerTitle'),
    heading: row.operation_name,
    amountLabel: t('wallet.walletActivity.column.amount'),
    amount: signed(row),
    effect: effectOf(row),
    at: row.created_at,
    route: routeOf(row),
  };
}

function openPending(row: IWalletPendingItem): void {
  const unpaidDeposit = row.type === Zeus.PaymentType.DEPOSIT && row.state === Zeus.WalletPendingState.AWAITING_PAYMENT;
  drawer.value = {
    hash: row.hash.toLowerCase(),
    title: row.title,
    steps: stepsOf(row),
    meta: orderMeta(row) || undefined,
    amountLabel: t('wallet.walletActivity.column.amount'),
    amount: formatAsset2Digits(row.quantity),
    at: row.created_at,
    state: row.state,
    // У пополнения реквизиты получателя — кооператива, их показывает блок оплаты.
    destination: row.type === Zeus.PaymentType.DEPOSIT ? null : destinationOf(row.payment_method_id),
  };
  if (unpaidDeposit) void loadPaymentOrder(row.hash);
}

/** Платёж неоплаченного взноса — реквизиты и код для оплаты, как в окне пополнения. */
async function loadPaymentOrder(hash: string): Promise<void> {
  const username = session.username;
  if (!username) return;
  try {
    const result = await paymentApi.loadPayments({ username, hash }, { page: 1, limit: 1, sortOrder: 'DESC' });
    const order = result.items[0] ?? null;
    if (drawer.value && drawer.value.hash === hash.toLowerCase()) drawer.value.paymentOrder = order;
  } catch (e) {
    FailAlert(e);
  }
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

.wallet-activity__amount--out,
.wallet-activity__amount--move {
  color: var(--p-ink);
}

.wallet-activity__amount--process {
  color: var(--p-ink-3);
}

.wallet-activity__sum {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
}



.wallet-activity__route {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--p-1);
  padding: var(--p-4) 0;
}

.wallet-activity__route-item {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
  padding: var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
}

.wallet-activity__route-icon {
  color: var(--p-ink-2);
  margin-top: 2px;
}

.wallet-activity__route-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.wallet-activity__route-label {
  color: var(--p-ink-3);
  font-size: var(--p-fs-meta);
}

.wallet-activity__route-title {
  font-weight: 600;
  color: var(--p-ink);
}

.wallet-activity__route-desc {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
}

.wallet-activity__route-arrow {
  display: flex;
  justify-content: center;
  color: var(--p-ink-3);
}

.wallet-activity__drawer-heading {
  margin-bottom: var(--p-4);
  font-size: var(--p-fs-h3);
  font-weight: 600;
  line-height: var(--p-lh-h3);
}
.wallet-activity__drawer-block {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  margin-top: var(--p-5);
}
.wallet-activity__drawer-subtitle {
  font-weight: 600;
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
