<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { listMyReturnClaims, type MarketplaceReturnClaimView } from '../api';
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

const orderIdInput = ref('');
const submitDialog = ref(false);
const detailsDialog = ref(false);
const selectedClaim = ref<MarketplaceReturnClaimView | null>(null);

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

function openSubmit(): void {
  if (!orderIdInput.value.trim()) {
    FailAlert(new Error('Укажите идентификатор полученного заказа.'));
    return;
  }
  submitDialog.value = true;
}

function openDetails(claim: MarketplaceReturnClaimView): void {
  selectedClaim.value = claim;
  detailsDialog.value = true;
}

function onSubmitted(): void {
  orderIdInput.value = '';
  void load();
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

onMounted(() => {
  void load();
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
        q-input.col(
          v-model="orderIdInput"
          outlined
          dense
          label="Идентификатор полученного заказа"
        )
        q-btn(
          unelevated no-caps color="primary"
          icon="fa-solid fa-clipboard-list"
          label="Подать заявление"
          :disable="!orderIdInput.trim()"
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
    :order-id="orderIdInput"
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
