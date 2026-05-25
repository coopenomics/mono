<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { listMyReturnClaims, type MarketplaceReturnClaimView } from '../api';
import { fetchMyOrders } from '../../MyOrders/api';
import type { MarketplaceOrderView } from '../../MyOrders/types';
import SubmitReturnClaimDialog from './SubmitReturnClaimDialog.vue';
import ReturnClaimDetailsDialog from './ReturnClaimDetailsDialog.vue';

/**
 * Story 7.1 — orderer-стол: список заявлений пайщика на гарантийный возврат
 * имущества. Карточки делятся на «активные» (PENDING_CHAIRMAN_REVIEW,
 * APPROVED_FOR_VISIT) и «архив» (REJECTED_REMOTELY, REJECTED_AT_VISIT,
 * ACCEPTED_AT_VISIT). На активной карточке заказчик может просмотреть
 * текущий decision_log; на ACCEPTED_AT_VISIT — увидеть восстановленную
 * сумму на программный кошелёк.
 *
 * Подача нового заявления (с фото-доказательством) идёт через
 * SubmitReturnClaimDialog (full-screen TakeoverDialog с пошаговым
 * wizard'ом, использует канонические виджеты).
 */

const items = ref<MarketplaceReturnClaimView[]>([]);
const loading = ref(false);

const selectedOrderId = ref<string | null>(null);
const eligibleOrders = ref<MarketplaceOrderView[]>([]);
const eligibleLoading = ref(false);
const submitDialog = ref(false);
const detailsDialog = ref(false);
const selectedClaim = ref<MarketplaceReturnClaimView | null>(null);

// Не предлагаем заказы, по которым уже открыта заявка: backend всё равно
// отклонит повторную (ConflictException), а пайщику бессмысленно её начинать.
const orderOptions = computed(() => {
  const openOrderIds = new Set(
    items.value
      .filter((c) => c.status === 'PENDING_CHAIRMAN_REVIEW' || c.status === 'APPROVED_FOR_VISIT')
      .map((c) => c.order_id),
  );
  return eligibleOrders.value
    .filter((o) => !openOrderIds.has(o.id))
    .map((o) => ({
      value: o.id,
      label: `Заказ ${o.id.slice(0, 8)} · ${o.quantity} ед. · ${o.total_cost} ₽`,
    }));
});

const activeClaims = computed(() =>
  items.value.filter(
    (c) => c.status === 'PENDING_CHAIRMAN_REVIEW' || c.status === 'APPROVED_FOR_VISIT',
  ),
);
const archiveClaims = computed(() =>
  items.value.filter(
    (c) =>
      c.status === 'ACCEPTED_AT_VISIT' ||
      c.status === 'REJECTED_REMOTELY' ||
      c.status === 'REJECTED_AT_VISIT',
  ),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listMyReturnClaims();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить заявления на возврат');
  } finally {
    loading.value = false;
  }
}

async function loadEligibleOrders(): Promise<void> {
  eligibleLoading.value = true;
  try {
    const result = await fetchMyOrders({ statuses: ['RECEIVED'], limit: 100 });
    eligibleOrders.value = result.items;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить полученные заказы');
  } finally {
    eligibleLoading.value = false;
  }
}

function openSubmit(): void {
  if (!selectedOrderId.value) {
    FailAlert(new Error('Выберите полученный заказ.'));
    return;
  }
  submitDialog.value = true;
}

function openDetails(claim: MarketplaceReturnClaimView): void {
  selectedClaim.value = claim;
  detailsDialog.value = true;
}

function onSubmitted(): void {
  selectedOrderId.value = null;
  void load();
  void loadEligibleOrders();
}

function humanStatus(status: MarketplaceReturnClaimView['status']): string {
  switch (status) {
    case 'PENDING_CHAIRMAN_REVIEW':
      return 'На рассмотрении председателя';
    case 'APPROVED_FOR_VISIT':
      return 'Очный визит одобрен';
    case 'ACCEPTED_AT_VISIT':
      return 'Возврат принят';
    case 'REJECTED_REMOTELY':
      return 'Отказано удалённо';
    case 'REJECTED_AT_VISIT':
      return 'Отказано на месте';
    default:
      return status;
  }
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ru-RU');
}

function statusColor(status: MarketplaceReturnClaimView['status']): string {
  switch (status) {
    case 'PENDING_CHAIRMAN_REVIEW':
      return 'primary';
    case 'APPROVED_FOR_VISIT':
      return 'info';
    case 'ACCEPTED_AT_VISIT':
      return 'positive';
    case 'REJECTED_REMOTELY':
    case 'REJECTED_AT_VISIT':
      return 'negative';
    default:
      return 'grey';
  }
}

onMounted(async () => {
  // Сначала заявки, потом заказы: orderOptions исключает заказы с открытой
  // заявкой, и без этого порядка возникает окно, когда select показывает
  // заказ, по которому возврат уже начат (backend всё равно отклонит).
  await load();
  await loadEligibleOrders();
});
</script>

<template lang="pug">
q-page.mp-role-orderer.mp-return-claims.q-pa-md
  .text-h6.q-mb-sm Гарантийный возврат имущества
  .text-body2.text-grey.q-mb-md
    | Подача заявления возможна только по выданному заказу в пределах гарантийного срока, заданного поставщиком.

  q-card.q-mb-md(flat bordered).mp-return-claims__submit
    q-card-section
      .row.q-gutter-md.items-center
        q-select.col(
          v-model="selectedOrderId"
          :options="orderOptions"
          :loading="eligibleLoading"
          outlined
          dense
          emit-value
          map-options
          label="Полученный заказ"
          :hint="orderOptions.length === 0 ? 'Нет полученных заказов, доступных для возврата' : 'Выберите заказ, по которому оформляете возврат'"
        )
        q-btn(
          unelevated no-caps color="primary"
          icon="fa-solid fa-clipboard-list"
          label="Подать заявление"
          :disable="!selectedOrderId"
          @click="openSubmit"
        )

  .text-subtitle1.q-mb-sm Активные заявления
  q-card(v-if="activeClaims.length === 0" flat bordered).q-pa-md.q-mb-md
    .text-grey Нет активных заявлений на возврат.
  q-list(v-else bordered separator).q-mb-md
    q-item(
      v-for="c in activeClaims" :key="c.id" clickable @click="openDetails(c)"
    )
      q-item-section
        q-item-label.text-weight-medium {{ c.actual_quantity }} ед. · {{ c.fact_cost }} ₽
        q-item-label(caption) Заказ {{ c.order_id.slice(0, 8) }} · подано {{ formatDate(c.created_at) }}
        q-item-label(caption) {{ c.reason_text.slice(0, 120) }}{{ c.reason_text.length > 120 ? '…' : '' }}
      q-item-section(side)
        q-chip(:color="statusColor(c.status)" text-color="white" dense) {{ humanStatus(c.status) }}

  .text-subtitle1.q-mb-sm Архив заявлений
  q-card(v-if="archiveClaims.length === 0" flat bordered).q-pa-md
    .text-grey Архив пуст.
  q-list(v-else bordered separator)
    q-item(
      v-for="c in archiveClaims" :key="c.id" clickable @click="openDetails(c)"
    )
      q-item-section
        q-item-label {{ c.actual_quantity }} ед. · {{ c.fact_cost }} ₽
        q-item-label(caption) Заказ {{ c.order_id.slice(0, 8) }}
        q-item-label(
          v-if="c.ledger_snapshot"
          caption
        ).text-positive
          | Восстановлено на программный кошелёк: {{ c.ledger_snapshot.amount }} ₽
      q-item-section(side)
        q-chip(:color="statusColor(c.status)" text-color="white" dense) {{ humanStatus(c.status) }}

  SubmitReturnClaimDialog(
    v-model="submitDialog"
    :order-id="selectedOrderId ?? ''"
    @submitted="onSubmitted"
  )

  ReturnClaimDetailsDialog(
    v-model="detailsDialog"
    :claim="selectedClaim"
  )
</template>

<style scoped lang="scss">
.mp-return-claims {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__submit {
    border-color: var(--mp-color-border, rgba(0, 0, 0, 0.12));
  }
}
</style>
