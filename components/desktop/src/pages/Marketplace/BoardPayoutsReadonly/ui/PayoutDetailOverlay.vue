<template lang="pug">
DetailsDrawer(
  :model-value='overlay.isOpen.value',
  :width='640',
  :title='$t("marketplace.payoutDetail.overlayTitle")',
  @update:model-value='(v) => !v && overlay.close()'
)
  .payout-detail(v-if='detail')
    .payout-detail__head
      .payout-detail__amount.t-mono {{ amountLabel }}
      BaseBadge(:variant='statusVariant(detail.payment.status)') {{ statusLabel(detail.payment.status) }}

    DataRow(:label='$t("marketplace.payoutDetail.supplierLabel")', :value='detail.payment.payee_name ?? detail.payment.payee_account')
    DataRow(:label='$t("marketplace.payoutDetail.purposeLabel")', :value='detail.payment.purpose')
    DataRow(:label='$t("marketplace.payoutDetail.createdLabel")', :value='formatDate(detail.payment.created_at)')
    DataRow(
      v-if='detail.payment.completed_at',
      :label='$t("marketplace.payoutDetail.paidLabel")',
      :value='formatDate(detail.payment.completed_at)'
    )
    DataRow(
      v-if='detail.payment.payout_destination',
      :label='$t("marketplace.payoutDetail.transferDestinationLabel")',
      :value='detail.payment.payout_destination'
    )
    DataRow(
      v-if='hasWithheld',
      :label='$t("marketplace.payoutDetail.heldForDebtLabel")',
      :value='formatAsset2Digits(String(detail.payment.withheld_amount))'
    )
    DataRow(
      v-if='detail.payment.decline_reason',
      :label='$t("marketplace.payoutDetail.rejectReasonLabel")',
      :value='detail.payment.decline_reason'
    )

    //- Что оплачивали: заказы поставщика, объединённые в эту выплату (одна
    //- выплата на заказы поставщика за день, решение владельца 19.11.2026).
    template(v-if='detail.orders.length')
      .payout-detail__section {{ $t('marketplace.payoutDetail.ordersSectionTitle', { count: detail.orders.length }) }}
      .payout-detail__order(v-for='o in detail.orders', :key='o.id')
        .payout-detail__order-body
          .payout-detail__order-name {{ o.product_name ?? '—' }}
          .payout-detail__order-meta {{ orderMeta(o) }}
        .payout-detail__order-side
          .payout-detail__order-sum.t-mono {{ formatAsset2Digits(String(o.accepted_cost ?? o.total_cost)) }}
          BaseBadge(:variant='orderStatusDisplay(o.status).variant') {{ orderStatusDisplay(o.status).label }}

    //- Подтверждение оплаты: запись кассирского реестра и проводка в цепи.
    .payout-detail__section {{ $t('marketplace.payoutDetail.paymentConfirmationTitle') }}
    template(v-if='detail.core_payment')
      DataRow(:label='$t("marketplace.payoutDetail.cooperativePaymentLabel")', :value='paymentStatusLabel(detail.core_payment.status)')
      DataRow(
        v-if='detail.core_payment.completed_at',
        :label='$t("marketplace.payoutDetail.processedLabel")',
        :value='formatDate(detail.core_payment.completed_at)'
      )
      DataRow(
        v-if='detail.core_payment.message',
        :label='$t("marketplace.payoutDetail.cashierCommentLabel")',
        :value='detail.core_payment.message'
      )
      DataRow(
        v-if='detail.core_payment.id',
        :label='$t("marketplace.payoutDetail.paymentNumberLabel")',
        :value='detail.core_payment.id',
        copyable,
        mono
      )
    .payout-detail__muted(v-else) {{ $t('marketplace.payoutDetail.paymentNotRegisteredHint') }}
    DataRow(
      v-if='detail.payment.payout_tx_hash',
      :label='$t("marketplace.payoutDetail.chainTransactionLabel")',
      :value='detail.payment.payout_tx_hash',
      copyable,
      mono
    )

  .payout-detail__muted(v-else-if='!loading') {{ $t('marketplace.payoutDetail.notFoundHint') }}
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { uiLocale, t } from 'src/shared/i18n';
import { FailAlert } from 'src/shared/api';
import { marketplaceQuantityLabel } from 'src/shared/lib/consts';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { paymentStatusLabel } from 'src/shared/lib/payment';
import { BaseBadge } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { getOutgoingPayment, type MarketplaceOutgoingPaymentDetailView } from '../api';
import { statusLabel, statusVariant } from '../lib/payoutStatus';

/**
 * Разворот выплаты — оверлеем поверх ленты (`?payout=<id>`, см. useQueryOverlay).
 *
 * Совету нужна не строка таблицы, а ответ на вопрос «за что заплатили»:
 * предмет поставки, состояние заказа и подтверждение оплаты (запись в реестре
 * кассира плюс проводка в цепи). Всё это собирает один запрос на бэкенде.
 */
const overlay = useQueryOverlay('payout');

const detail = ref<MarketplaceOutgoingPaymentDetailView | null>(null);
const loading = ref(false);

const amountLabel = ref('');
const hasWithheld = ref(false);

/**
 * Подпись заказа в выплате: объём (единица — русской подписью из общего
 * справочника, сырое «liter» читается как чужой текст), участок, заказчик.
 */
function orderMeta(o: { quantity: number; unit_of_measure?: string | null; delivery_point_name?: string | null; orderer_name?: string | null }): string {
  return [marketplaceQuantityLabel(o.quantity, o.unit_of_measure ?? null), o.delivery_point_name, o.orderer_name]
    .filter(Boolean)
    .join(' · ');
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString(uiLocale());
}

async function load(id: string): Promise<void> {
  loading.value = true;
  try {
    detail.value = await getOutgoingPayment(id);
    const d = detail.value;
    amountLabel.value = d ? `${formatAsset2Digits(String(d.payment.amount))} ${d.payment.symbol}` : '';
    hasWithheld.value = !!d && Number.parseFloat(String(d.payment.withheld_amount)) > 0;
  } catch (e) {
    detail.value = null;
    FailAlert(e, t('marketplace.payoutDetail.loadFailedError'));
  } finally {
    loading.value = false;
  }
}

watch(
  overlay.value,
  (id) => {
    if (!id) {
      detail.value = null;
      return;
    }
    void load(id);
  },
  { immediate: true },
);

// Открытая выплата живёт по ленте: заявка, оплата кассиром и её проводка
// обновляют карточку.
useLiveReload([...marketLiveTables('payment'), { code: 'core', table: 'payments' }], async () => {
  if (overlay.value.value) await load(overlay.value.value);
});
</script>

<style scoped lang="scss">
.payout-detail {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3);
    margin-bottom: var(--p-2);
  }

  &__amount {
    font-size: var(--p-fs-h1);
    font-weight: 600;
  }

  // Заказ выплаты: имущество и подпись слева, принятая сумма и состояние справа.
  &__order {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--p-3);
    padding: var(--p-2) 0;
    border-top: 1px solid var(--p-line);
  }

  &__order-name {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__order-meta {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__order-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--p-1);
  }

  &__order-sum {
    font-weight: 600;
    white-space: nowrap;
  }

  &__section {
    margin-top: var(--p-4);
    color: var(--p-ink-3);
    font-size: var(--p-fs-eyebrow);
    line-height: var(--p-lh-eyebrow);
    text-transform: uppercase;
    letter-spacing: var(--p-ls-eyebrow);
  }

  &__muted {
    color: var(--p-ink-3);
  }
}
</style>
