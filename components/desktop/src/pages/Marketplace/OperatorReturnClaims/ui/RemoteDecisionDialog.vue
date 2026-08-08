<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import {
  approveReturnVisit,
  rejectReturnRemote,
  defectCategoryLabel,
  type MarketplaceReturnClaimView,
} from '../api';

/**
 * Story 7.2 / FR31: full-screen takeover для удалённого решения председателя.
 * Председатель видит причину обращения и фото пайщика и принимает одно из
 * двух решений:
 *  - «Пригласить на очный осмотр» → aprretrem (`APPROVED_FOR_VISIT`);
 *  - «Отказать удалённо»          → rejretrem (`REJECTED_REMOTELY`, final).
 *
 * Comment обязателен только при отказе (пайщик должен видеть причину);
 * приглашение на осмотр самодостаточно и не требует пояснения.
 */

const props = defineProps<{
  modelValue: boolean;
  claim: MarketplaceReturnClaimView | null;
  braname: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'decided'): void;
}>();

const DECISION_APPROVE = 'approve' as const;
const DECISION_REJECT = 'reject' as const;
type Decision = typeof DECISION_APPROVE | typeof DECISION_REJECT;

const decision = ref<Decision>(DECISION_APPROVE);
const comment = ref<string>('');
const submitting = ref(false);

watch(
  () => [props.modelValue, props.claim?.id],
  ([visible]) => {
    if (visible) {
      decision.value = DECISION_APPROVE;
      comment.value = '';
    }
  },
  { immediate: false },
);

async function confirm(): Promise<void> {
  if (!props.claim) return;
  if (decision.value === DECISION_REJECT && !comment.value.trim()) {
    FailAlert(new Error('Укажите причину отказа: пайщик её увидит в уведомлении.'));
    return;
  }
  if (!props.braname.trim()) {
    FailAlert(new Error('Не выбран кооперативный участок.'));
    return;
  }
  submitting.value = true;
  try {
    if (decision.value === DECISION_APPROVE) {
      await approveReturnVisit({
        claim_id: props.claim.id,
        braname: props.braname.trim(),
        comment: comment.value.trim(),
      });
      SuccessAlert('Заказчик приглашён на очный осмотр. Уведомление отправлено.');
    } else {
      await rejectReturnRemote({
        claim_id: props.claim.id,
        braname: props.braname.trim(),
        comment: comment.value.trim(),
      });
      SuccessAlert('Заявление отклонено удалённо. Уведомление отправлено.');
    }
    emit('decided');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось зафиксировать решение в блокчейне');
  } finally {
    submitting.value = false;
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}

const kind = computed<'info' | 'warning'>(() =>
  decision.value === DECISION_APPROVE ? 'info' : 'warning',
);
const confirmLabel = computed(() =>
  decision.value === DECISION_APPROVE ? 'Пригласить на очный осмотр' : 'Отказать удалённо',
);
// Мотивировать нужно только отказ — приглашение на очный осмотр самодостаточно.
const commentRequired = computed(() => decision.value === DECISION_REJECT);
const commentLabel = computed(() =>
  commentRequired.value ? 'Комментарий для пайщика (обязательно)' : 'Комментарий для пайщика (необязательно)',
);

const decisionOptions = [
  { label: 'Пригласить заказчика на очный осмотр на КУ', value: DECISION_APPROVE, color: 'primary' },
  { label: 'Отказать удалённо (без очного визита)', value: DECISION_REJECT, color: 'warning' },
];
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  :title="claim ? `Удалённое решение по заявлению ${claim.id.slice(0, 8)}` : 'Заявление'"
  :lead-text="claim ? `Заказ ${claim.order_id.slice(0, 8)} · заказчик ${claim.orderer_name || claim.orderer_account} · ${formatAsset2Digits(claim.fact_cost)} ₽` : ''"
  :kind="kind"
  :confirm-label="confirmLabel"
  cancel-label="Закрыть"
  :loading="submitting"
  :disable-confirm="(commentRequired && !comment.trim()) || submitting"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="confirm"
  @cancel="cancel"
)
  template(#default v-if="claim")
    .mp-return-remote
      q-card(flat bordered).q-mb-md
        q-card-section
          .text-subtitle1 Обращение пайщика
          .q-mt-sm {{ claim.reason_text }}
          .q-mt-sm.text-caption.text-grey(v-if="claim.defect_category")
            | Категория дефекта: {{ defectCategoryLabel(claim.defect_category) }}

      q-card(flat bordered).q-mb-md
        q-card-section
          .text-subtitle1 Фотографии товара
          .row.q-mt-sm.q-gutter-sm
            a.mp-return-remote__thumb(
              v-for="(p, i) in claim.photos" :key="p.content_hash"
              :href="p.url" target="_blank" rel="noopener"
            )
              img(:src="p.url" :alt="`Фото ${i + 1}`")

      q-card(flat bordered).q-pa-md
        .text-subtitle1.q-mb-sm Решение
        q-option-group(
          v-model="decision"
          :options="decisionOptions"
          type="radio"
          inline
        )
        q-input.q-mt-md(
          v-model="comment"
          outlined
          type="textarea"
          autogrow
          counter
          maxlength="500"
          :label="commentLabel"
          :placeholder="decision === DECISION_APPROVE ? 'Например: приходите с продукцией в часы работы участка.' : 'Например: гарантийный срок возврата не покрывает данный тип повреждений.'"
        )
</template>

<style scoped lang="scss">
.mp-return-remote {
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
