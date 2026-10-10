<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';
import { BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { setReviewStatus, type MarketplaceReviewView } from 'src/entities/MarketplaceReview';

/**
 * Администратор скрывает отзыв: причина обязательна, её увидит автор.
 * Скрытый отзыв уходит из списков и из сводной оценки.
 */
const REASON_MAX = 1000;

const props = defineProps<{
  modelValue: boolean;
  review: MarketplaceReviewView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', review: MarketplaceReviewView): void;
}>();

const reason = ref('');
const saving = ref(false);

const canSubmit = computed(() => reason.value.trim().length > 0 && reason.value.length <= REASON_MAX);

watch(
  () => props.modelValue,
  (open) => {
    if (open) reason.value = '';
  },
);

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (!props.review || !canSubmit.value || saving.value) return;
  saving.value = true;
  try {
    const saved = await setReviewStatus({
      id: props.review.id,
      status: Zeus.MarketplaceReviewStatus.HIDDEN,
      reason: reason.value.trim(),
    });
    SuccessAlert(t('marketplace.reviewHideDialog.hiddenNotice'));
    emit('saved', saved);
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue",
  :title="$t('marketplace.reviewHideDialog.title')",
  size="sm",
  @update:model-value="emit('update:modelValue', $event)"
)
  .review-hide
    .review-hide__note {{ $t('marketplace.reviewHideDialog.note') }}
    BaseInput(
      v-model="reason",
      type="textarea",
      :rows="3",
      autogrow,
      autofocus,
      :label="$t('marketplace.reviewHideDialog.reasonLabel')",
      :error="reason.length > REASON_MAX ? $t('marketplace.reviewHideDialog.reasonTooLong', { max: REASON_MAX }) : undefined"
    )
  template(#footer)
    BaseButton(variant="ghost", :disabled="saving", @click="close") {{ $t('common.action.cancel') }}
    BaseButton(variant="danger", :loading="saving", :disabled="!canSubmit", @click="submit") {{ $t('marketplace.reviewHideDialog.submitAction') }}
</template>

<style scoped lang="scss">
.review-hide {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);

  &__note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }
}
</style>
