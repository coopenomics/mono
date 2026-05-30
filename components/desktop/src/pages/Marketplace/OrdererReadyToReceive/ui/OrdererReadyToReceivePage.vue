<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { BaseButton, BaseDialog, EmptyState } from 'src/shared/ui/base';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import { HandoffQr } from 'src/widgets/Marketplace/HandoffQr';
import { PageHint } from 'src/shared/ui/domain';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { encodeHandoffToken, HandoffTokenKind } from 'src/shared/lib/marketplace';
import { listMyReadyToReceive, type MarketplaceOrderIssuanceView } from '../api';

/**
 * Story 6.3 / FR22: orderer-стол «Готово к получению».
 *
 * Показывает заказы текущего пайщика в статусе READY_TO_RECEIVE — оператор
 * на ПВЗ уже открыл выдачу первой подписью, пайщик может прийти на КУ для
 * сверки имущества и финальной подписи (`signiss2`). Страница на MONO
 * Platform v2: канон-таблица, пустой экран — `EmptyState`.
 *
 * Push-уведомление marketplace-order-ready (FR22) шлётся бэком сразу
 * после `signiss1` через MarketplaceNotificationService; этот стол —
 * визуальное продолжение уведомления.
 */

const route = useRoute();
const session = useSessionStore();
const coopname = computed(() => String(route.params.coopname ?? ''));

const items = ref<MarketplaceOrderIssuanceView[]>([]);
const loading = ref(false);

// Story 14.4: один account-bound код получения. Заказчик показывает его
// оператору выдачи — тот резолвит аккаунт против ленты своего КУ и видит разом
// все готовые к выдаче заказы этого заказчика. Код привязан к личности, не к
// заказу: его можно показать заранее или с распечатки.
const myCodeDialogOpen = ref(false);
const myReceiveCode = computed(() =>
  session.username
    ? encodeHandoffToken({
        kind: HandoffTokenKind.Receive,
        coopname: coopname.value,
        account: session.username,
      })
    : '',
);

function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU');
}

const columns: QTableProps['columns'] = [
  { name: 'order', label: 'Заказ', field: (r: MarketplaceOrderIssuanceView) => r.id.slice(0, 8), align: 'left' },
  {
    name: 'product',
    label: 'Товар',
    field: (r: MarketplaceOrderIssuanceView) => r.product_name || 'Товар по предложению',
    align: 'left',
  },
  {
    name: 'ku',
    label: 'Пункт выдачи',
    field: (r: MarketplaceOrderIssuanceView) =>
      [r.delivery_point_name, r.delivery_point_address].filter(Boolean).join(' · ') || r.delivery_braname,
    align: 'left',
  },
  {
    name: 'quantity',
    label: 'Количество',
    field: 'quantity',
    align: 'right',
    format: (v: unknown, r: MarketplaceOrderIssuanceView) => `${v} ${marketplaceUnitShort(r.unit_of_measure)}`,
  },
  {
    name: 'total_cost',
    label: 'Сумма заказа',
    field: 'total_cost',
    align: 'right',
    format: (v: unknown) => `${formatAsset2Digits(String(v ?? ''))} ₽`,
  },
  {
    name: 'opened_at',
    label: 'Открыто к выдаче',
    field: 'chairman_signed_at',
    align: 'left',
    format: (v: unknown) => formatDate(v),
  },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listMyReadyToReceive();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить заказы, готовые к получению');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template lang="pug">
q-page.ready(role="region", aria-label="Готово к получению")
  //- Действие страницы — в шапку, где стоят общие действия (канон Teleport).
  Teleport(to="#header-actions-host", defer)
    BaseButton(variant="secondary", size="sm", :disabled="!myReceiveCode", @click="myCodeDialogOpen = true")
      template(#icon-left)
        q-icon(name="qr_code_2", size="16px")
      | Мой код получения
    RefreshButton(:loading="loading", @refresh="load")

  PageHint(storage-key="mp:ready-to-receive:banner-dismissed")
    | Оператор открыл выдачу этих заказов на пункте. Приходите на участок для сверки имущества и финальной подписи.

  q-table(
    :rows="items",
    :columns="columns",
    row-key="id",
    flat,
    bordered,
    :loading="loading"
  )
    template(#no-data)
      EmptyState(
        title="Нет заказов, готовых к получению",
        body="Как только оператор откроет выдачу заказа, он появится здесь."
      )
        template(#icon)
          q-icon(name="inventory_2", size="48px")

  BaseDialog(v-model="myCodeDialogOpen", title="Мой код получения", size="sm")
    .ready__qr(v-if="myReceiveCode")
      HandoffQr(
        :value="myReceiveCode",
        caption="Покажите этот код оператору на пункте выдачи — он выдаст разом все ваши готовые заказы. Код можно показать заранее или с распечатки."
      )

</template>

<style scoped lang="scss">
.ready {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) 0;
  }
}

@media (max-width: 768px) {
  .ready {
    padding: var(--p-4, 16px);
  }
}
</style>
