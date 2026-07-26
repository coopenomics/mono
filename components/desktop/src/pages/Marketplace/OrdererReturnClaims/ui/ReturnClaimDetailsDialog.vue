<script lang="ts" setup>
import { computed } from 'vue';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { defectCategoryLabel, type MarketplaceReturnClaimView } from '../api';

/**
 * Story 7.1-7.4 — детали заявления для пайщика: текущий статус, причина,
 * фото (только просмотр), журнал решений председателя, и при принятии
 * возврата — снапшот compensating-forward (восстановленная сумма + tx_hash
 * композитной транзакции `accretrn`).
 */

const props = defineProps<{
  modelValue: boolean;
  claim: MarketplaceReturnClaimView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const decisionLabelMap: Record<string, string> = {
  approve_visit: 'Председатель пригласил на очный осмотр',
  reject_remote: 'Отказано удалённо',
  accept_at_visit: 'Возврат принят на очном осмотре',
  reject_at_visit: 'Отказано на очном осмотре',
};

const statusLabelMap: Record<MarketplaceReturnClaimView['status'], string> = {
  PENDING_CHAIRMAN_REVIEW: 'На рассмотрении председателя',
  APPROVED_FOR_VISIT: 'Очный визит одобрен',
  ACCEPTED_AT_VISIT: 'Возврат принят',
  REJECTED_REMOTELY: 'Отказано удалённо',
  REJECTED_AT_VISIT: 'Отказано на месте',
};

const statusKind = computed<'info' | 'success' | 'warning' | 'danger'>(() => {
  if (!props.claim) return 'info';
  switch (props.claim.status) {
    case 'ACCEPTED_AT_VISIT':
      return 'success';
    case 'REJECTED_REMOTELY':
    case 'REJECTED_AT_VISIT':
      return 'danger';
    case 'APPROVED_FOR_VISIT':
      return 'warning';
    default:
      return 'info';
  }
});

function humanDecision(decision: string): string {
  return decisionLabelMap[decision] ?? decision;
}

function close(): void {
  emit('update:modelValue', false);
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU');
}
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  :title="claim ? `Заявление ${claim.id.slice(0, 8)} — ${statusLabelMap[claim.status]}` : 'Заявление'"
  :lead-text="claim ? `Заказ ${claim.order_id.slice(0, 8)} · ${claim.actual_quantity} ед. · ${claim.total_refund} ₽` : ''"
  :kind="statusKind"
  cancel-label="Закрыть"
  confirm-label="Готово"
  :disable-confirm="false"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="close"
  @cancel="close"
)
  template(#default v-if="claim")
    .mp-return-details
      q-card(flat bordered).q-mb-md
        q-card-section
          .text-subtitle1 Причина обращения
          .q-mt-sm {{ claim.reason_text }}
          .q-mt-sm.text-caption.text-grey(v-if="claim.defect_category")
            | Категория дефекта: {{ defectCategoryLabel(claim.defect_category) }}
          .q-mt-sm.text-caption.text-grey
            | Якорный hash on-chain: {{ claim.request_hash.slice(0, 16) }}…

      q-card(flat bordered).q-mb-md
        q-card-section
          .text-subtitle1 Приложенные фотографии
          .row.q-mt-sm.q-gutter-sm
            a.mp-return-details__thumb(
              v-for="(p, i) in claim.photos" :key="p.content_hash"
              :href="p.url" target="_blank" rel="noopener"
            )
              img(:src="p.url" :alt="`Фото ${i + 1}`")

      q-card(flat bordered).q-mb-md(v-if="claim.decision_log.length > 0")
        q-card-section
          .text-subtitle1 История решений председателя
          q-timeline(layout="dense" color="primary").q-mt-sm
            q-timeline-entry(
              v-for="entry in claim.decision_log" :key="entry.tx_hash"
              :title="humanDecision(entry.decision)"
              :subtitle="`${entry.by_chairman_account} · КУ ${entry.braname} · ${formatDateTime(entry.at)}`"
              :color="entry.decision === 'accept_at_visit' ? 'positive' : entry.decision === 'reject_remote' || entry.decision === 'reject_at_visit' ? 'negative' : 'primary'"
            )
              | {{ entry.comment }}

      q-card(flat bordered).q-mb-md(v-if="claim.on_site_inspection")
        q-card-section
          .text-subtitle1 Результат очного осмотра
          .q-mt-sm {{ claim.on_site_inspection.result_text }}
          .q-mt-sm.text-caption.text-grey(v-if="claim.on_site_inspection.scanned_barcode")
            | Сканированный штрих-код: {{ claim.on_site_inspection.scanned_barcode }}
          .row.q-mt-sm.q-gutter-sm(v-if="claim.on_site_inspection.photos.length > 0")
            a.mp-return-details__thumb(
              v-for="(p, i) in claim.on_site_inspection.photos" :key="p.content_hash"
              :href="p.url" target="_blank" rel="noopener"
            )
              img(:src="p.url" :alt="`Фото осмотра ${i + 1}`")

      q-card(flat bordered).bg-positive.text-white(v-if="claim.ledger_snapshot")
        q-card-section
          .text-subtitle1 Возврат принят
          .q-mt-sm
            | Восстановлено на программный кошелёк Стола Заказов:
            strong.q-ml-xs {{ claim.ledger_snapshot.amount }} ₽
          .text-caption.q-mt-sm
            | Композитная транзакция accretrn: {{ claim.ledger_snapshot.tx_hash }}
          .text-caption
            | Вы можете направить средства на следующий заказ либо вывести в общий членский кошелёк отдельным действием.
</template>

<style scoped lang="scss">
.mp-return-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__thumb {
    display: inline-block;
    width: 96px;
    height: 96px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}
</style>
