<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { BaseBadge, BaseButton, BaseDialog, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { QrScanner } from 'src/widgets/Marketplace/QrScanner';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { decodeHandoffToken, HandoffTokenKind } from 'src/shared/lib/marketplace';
import {
  listIssuancesByBraname,
  type MarketplaceOrderIssuanceView,
} from '../api';
import IssueActOpenDialog from './IssueActOpenDialog.vue';
import IssueActFinalizeDialog from './IssueActFinalizeDialog.vue';

/**
 * Story 6.1 / 6.3 / 6.6: operator-стол выдачи имущества пайщику.
 *
 * Показывает Order'ы на КУ выдачи в статусах ACCEPTED_TO_COOP (ожидают
 * открытия первой подписью председателя — `signiss1`) и READY_TO_RECEIVE
 * (ожидают финальной подписи заказчика на ПВЗ — `signiss2`).
 *
 * - «Открыть выдачу» вызывает IssueActOpenDialog — full-screen takeover
 *   с превью акта (registry_id=1102) и подписью председателя.
 * - «Завершить выдачу» вызывает IssueActFinalizeDialog — BarcodeScanner
 *   для проверки штрих-кода заказа + CorrectionTable со сверкой
 *   факт vs заказ + двойная подпись (заказчик + delivery_signer) и
 *   композитная транзакция `signiss2` с корректирующими операциями
 *   по FR23-FR25.
 */

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const items = ref<MarketplaceOrderIssuanceView[]>([]);
const loading = ref(false);

const openDialog = ref(false);
const finalizeDialog = ref(false);
const selectedOrder = ref<MarketplaceOrderIssuanceView | null>(null);

const columns: QTableProps['columns'] = [
  { name: 'order', label: 'Заказ', field: (r: MarketplaceOrderIssuanceView) => r.id.slice(0, 8), align: 'left' },
  {
    name: 'product',
    label: 'Товар',
    field: (r: MarketplaceOrderIssuanceView) => r.product_name || 'Товар по предложению',
    align: 'left',
  },
  { name: 'orderer', label: 'Заказчик', field: 'orderer_account', align: 'left' },
  {
    name: 'quantity',
    label: 'Количество',
    field: 'quantity',
    align: 'right',
    format: (v: unknown, r: MarketplaceOrderIssuanceView) => `${v} ${marketplaceUnitShort(r.unit_of_measure)}`,
  },
  { name: 'total_cost', label: 'Сумма', field: 'total_cost', align: 'right' },
  { name: 'status', label: 'Статус', field: 'status', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    items.value = await listIssuancesByBraname(braname.value.trim());
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить ленту выдач');
  } finally {
    loading.value = false;
  }
}

function startOpen(item: MarketplaceOrderIssuanceView): void {
  selectedOrder.value = item;
  openDialog.value = true;
}

function startFinalize(item: MarketplaceOrderIssuanceView): void {
  selectedOrder.value = item;
  finalizeDialog.value = true;
}

// QR-код получения (Story 14.4): оператор сканирует account-bound код заказчика
// → резолвим аккаунт против ленты своего КУ и показываем РАЗОМ все его заказы
// на выдачу.
const scanDialogOpen = ref(false);

// Статусы заказа, релевантные выдаче (ожидают открытия или финальной подписи).
const ISSUANCE_STATUSES = ['ACCEPTED_TO_COOP', 'READY_TO_RECEIVE'];

// Резолв account-bound кода: все заказы заказчика на выдачу на этом КУ.
const pickupDialogOpen = ref(false);
const pickupAccount = ref('');
const pickupOrders = computed(() =>
  items.value.filter(
    (o) => o.orderer_account === pickupAccount.value && ISSUANCE_STATUSES.includes(o.status),
  ),
);

// Открыть/завершить выдачу одного заказа. Панель агрегированных заказов
// заказчика остаётся открытой под полноэкранным шагом выдачи — по `load()`
// список пересчитывается, выданный заказ уходит, оператор продолжает следующий.
function startIssuanceStep(order: MarketplaceOrderIssuanceView): void {
  if (order.status === 'ACCEPTED_TO_COOP') {
    startOpen(order);
  } else if (order.status === 'READY_TO_RECEIVE') {
    startFinalize(order);
  } else {
    FailAlert(new Error('Заказ не в статусе выдачи.'));
  }
}

function onQrScanned(code: string): void {
  scanDialogOpen.value = false;
  const token = decodeHandoffToken(code);
  if (!token || token.kind !== HandoffTokenKind.Receive) {
    FailAlert(new Error('Нераспознанный код заказчика. Отсканируйте «Мой код получения» со стола заказчика.'));
    return;
  }
  if (token.coopname && token.coopname !== coopname.value) {
    FailAlert(new Error('Код выписан для другого кооператива.'));
    return;
  }
  const has = items.value.some(
    (o) => o.orderer_account === token.account && ISSUANCE_STATUSES.includes(o.status),
  );
  if (!has) {
    FailAlert(new Error(`У заказчика ${token.account} нет заказов на выдачу на этом пункте.`));
    return;
  }
  pickupAccount.value = token.account;
  pickupDialogOpen.value = true;
}

function onOpened(): void {
  void load();
}

function onFinalized(): void {
  void load();
}

watch(braname, () => void load());

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  void load();
});
</script>

<template lang="pug">
q-page.issuance(role='region', aria-label='Выдача заказов')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Выдача заказов доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-issuance:banner-dismissed')
      | Заказы, принятые кооперативом на ваш пункт выдачи. Откройте выдачу подписью председателя, затем завершите её на стойке с заказчиком.

    .issuance__toolbar
      BaseButton(variant='secondary', @click='scanDialogOpen = true')
        template(#icon-left)
          q-icon(name='qr_code_scanner', size='16px')
        | Сканировать QR заказа

    q-table.issuance__table(
      :rows='items',
      :columns='columns',
      row-key='id',
      flat,
      bordered,
      :loading='loading'
    )
      template(#body-cell-status='props')
        q-td(:props='props')
          BaseBadge(:variant='orderStatusDisplay(props.row.status).variant') {{ orderStatusDisplay(props.row.status).label }}

      template(#body-cell-actions='props')
        q-td(:props='props')
          BaseButton(
            v-if='props.row.status === "ACCEPTED_TO_COOP"',
            variant='primary',
            size='sm',
            @click='startOpen(props.row)'
          )
            template(#icon-left)
              q-icon(name='draw', size='16px')
            | Открыть выдачу
          BaseButton(
            v-else-if='props.row.status === "READY_TO_RECEIVE"',
            variant='primary',
            size='sm',
            @click='startFinalize(props.row)'
          )
            template(#icon-left)
              q-icon(name='inventory', size='16px')
            | Завершить выдачу

      template(#no-data)
        EmptyState(
          title='Заказов на выдачу нет',
          body='Заказы, принятые кооперативом на ваш участок, появятся здесь для выдачи пайщикам.'
        )
          template(#icon)
            q-icon(name='inventory', size='48px')

  IssueActOpenDialog(
    v-model='openDialog',
    :order='selectedOrder',
    @opened='onOpened'
  )
  IssueActFinalizeDialog(
    v-model='finalizeDialog',
    :order='selectedOrder',
    @finalized='onFinalized'
  )

  BaseDialog(v-model='scanDialogOpen', title='Сканирование QR заказа', size='sm')
    QrScanner(@scanned='onQrScanned')

  //- Story 14.4: все заказы заказчика на выдачу разом (резолв account-bound
  //- кода против ленты этого КУ). Оператор открывает/завершает их по одному —
  //- каждый шаг выдачи имеет собственную двойную подпись.
  BaseDialog(v-model='pickupDialogOpen', title='Выдача заказчику', size='sm')
    .issuance__resolve
      .issuance__resolve-account {{ pickupAccount }}
      .issuance__resolve-hint(v-if='pickupOrders.length') Готовы к выдаче на этом пункте:
      .issuance__resolve-empty(v-else) Все заказы этого заказчика уже выданы.
      .issuance__resolve-item(v-for='o in pickupOrders', :key='o.id')
        .issuance__resolve-item-info
          .issuance__resolve-item-title {{ o.product_name || 'Товар по предложению' }}
          .issuance__resolve-item-meta {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }} · {{ orderStatusDisplay(o.status).label }}
        BaseButton(
          v-if='o.status === "ACCEPTED_TO_COOP"',
          variant='primary',
          size='sm',
          @click='startIssuanceStep(o)'
        )
          template(#icon-left)
            q-icon(name='draw', size='16px')
          | Открыть
        BaseButton(
          v-else-if='o.status === "READY_TO_RECEIVE"',
          variant='primary',
          size='sm',
          @click='startIssuanceStep(o)'
        )
          template(#icon-left)
            q-icon(name='inventory', size='16px')
          | Завершить
</template>

<style scoped lang="scss">
.issuance {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    justify-content: flex-end;
  }

  &__resolve {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__resolve-account {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    font-family: var(--font-mono);
  }

  &__resolve-hint,
  &__resolve-empty {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__resolve-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }

  &__resolve-item-info {
    min-width: 0;
  }

  &__resolve-item-title {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__resolve-item-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }
}

@media (max-width: 768px) {
  .issuance {
    padding: var(--p-4, 16px);
  }
}
</style>
