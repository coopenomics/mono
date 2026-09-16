<template lang="pug">
DetailsDrawer(
  :model-value='overlay.isOpen.value',
  :width='640',
  title='Выплата',
  @update:model-value='(v) => !v && overlay.close()'
)
  .payout-detail(v-if='detail')
    .payout-detail__head
      .payout-detail__amount.t-mono {{ amountLabel }}
      BaseBadge(:variant='statusVariant(detail.payment.status)') {{ statusLabel(detail.payment.status) }}

    DataRow(label='Поставщик', :value='detail.payment.payee_name ?? detail.payment.payee_account')
    DataRow(label='Назначение', :value='detail.payment.purpose')
    DataRow(label='Создана', :value='formatDate(detail.payment.created_at)')
    DataRow(
      v-if='detail.payment.completed_at',
      label='Оплачена',
      :value='formatDate(detail.payment.completed_at)'
    )
    DataRow(
      v-if='detail.payment.payout_destination',
      label='Куда переведено',
      :value='detail.payment.payout_destination'
    )
    DataRow(
      v-if='hasWithheld',
      label='Удержано в счёт долга',
      :value='formatAsset2Digits(String(detail.payment.withheld_amount))'
    )
    DataRow(
      v-if='detail.payment.decline_reason',
      label='Причина отказа',
      :value='detail.payment.decline_reason'
    )

    //- Что оплачивали. Без заказа выплата — просто сумма, поэтому предмет
    //- поставки идёт сразу под реквизитами платежа, а не в конце.
    template(v-if='detail.order')
      .payout-detail__section Заказ
      DataRow(label='Товар', :value='detail.order.product_name ?? "—"')
      DataRow(label='Объём', :value='volumeLabel')
      DataRow(label='Стоимость заказа', :value='formatAsset2Digits(String(detail.order.total_cost))')
      DataRow(
        v-if='detail.order.accepted_cost && detail.order.accepted_cost !== detail.order.total_cost',
        label='Принято на сумму',
        :value='formatAsset2Digits(String(detail.order.accepted_cost))'
      )
      DataRow(label='Состояние заказа', :value='orderStatusDisplay(detail.order.status).label')
      DataRow(
        v-if='detail.order.delivery_point_name',
        label='Участок доставки',
        :value='detail.order.delivery_point_name'
      )
      DataRow(
        v-if='detail.order.orderer_name',
        label='Заказчик',
        :value='detail.order.orderer_name'
      )

    //- Подтверждение оплаты: запись кассирского реестра и проводка в цепи.
    .payout-detail__section Подтверждение оплаты
    template(v-if='detail.core_payment')
      DataRow(label='Платёж кооператива', :value='paymentStatusLabel(detail.core_payment.status)')
      DataRow(
        v-if='detail.core_payment.completed_at',
        label='Проведён',
        :value='formatDate(detail.core_payment.completed_at)'
      )
      DataRow(
        v-if='detail.core_payment.message',
        label='Комментарий кассира',
        :value='detail.core_payment.message'
      )
      DataRow(
        v-if='detail.core_payment.id',
        label='Платёж №',
        :value='detail.core_payment.id',
        copyable,
        mono
      )
    .payout-detail__muted(v-else) Платёж в реестре кассира ещё не заведён.
    DataRow(
      v-if='detail.payment.payout_tx_hash',
      label='Транзакция в цепи',
      :value='detail.payment.payout_tx_hash',
      copyable,
      mono
    )

  .payout-detail__muted(v-else-if='!loading') Выплата не найдена.
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
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
const volumeLabel = ref('');
const hasWithheld = ref(false);

function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU');
}

async function load(id: string): Promise<void> {
  loading.value = true;
  try {
    detail.value = await getOutgoingPayment(id);
    const d = detail.value;
    amountLabel.value = d ? `${formatAsset2Digits(String(d.payment.amount))} ${d.payment.symbol}` : '';
    // Единица — русской подписью из общего справочника marketplace: сырое
    // значение enum'а («liter») в карточке читается как чужой текст.
    volumeLabel.value = d?.order
      ? marketplaceQuantityLabel(d.order.quantity, d.order.unit_of_measure)
      : '';
    hasWithheld.value = !!d && Number.parseFloat(String(d.payment.withheld_amount)) > 0;
  } catch (e) {
    detail.value = null;
    FailAlert(e, 'Не удалось загрузить выплату');
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
