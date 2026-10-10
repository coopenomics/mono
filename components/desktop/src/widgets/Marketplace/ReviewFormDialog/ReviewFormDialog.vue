<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';
import { BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
import {
  createReview,
  updateMyReview,
  type MarketplaceReviewView,
} from 'src/entities/MarketplaceReview';

/**
 * Отзыв заказчика по полученному заказу: оценка от одной до пяти звёзд и
 * текст. Тем же окном автор правит уже оставленный отзыв.
 */
const TEXT_MAX = 4000;

const props = defineProps<{
  modelValue: boolean;
  /** Заказ, о котором отзыв. */
  orderId: string;
  /** Название предложения — строкой под заголовком. */
  offerName?: string | null;
  /** Уже оставленный отзыв: окно открывается в режиме правки. */
  review?: MarketplaceReviewView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', review: MarketplaceReviewView): void;
}>();

const stars = ref(0);
const text = ref('');
const saving = ref(false);

const isEdit = computed(() => Boolean(props.review));
const title = computed(() =>
  isEdit.value ? t('marketplace.reviewFormDialog.titleEdit') : t('marketplace.reviewFormDialog.titleCreate'),
);
const canSubmit = computed(() => stars.value >= 1 && text.value.length <= TEXT_MAX);

// Окно открыли — поля берутся из отзыва либо пусты.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    stars.value = props.review?.stars ?? 0;
    text.value = props.review?.text ?? '';
  },
  { immediate: true },
);

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (!canSubmit.value || saving.value) return;
  saving.value = true;
  try {
    const saved = props.review
      ? await updateMyReview({ id: props.review.id, stars: stars.value, text: text.value })
      : await createReview({ order_id: props.orderId, stars: stars.value, text: text.value });
    SuccessAlert(t('marketplace.reviewFormDialog.savedNotice'));
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
BaseDialog(:model-value="modelValue", :title="title", size="md", @update:model-value="emit('update:modelValue', $event)")
  .review-form
    .review-form__offer(v-if="offerName") {{ offerName }}
    .review-form__field
      .review-form__label {{ $t('marketplace.reviewFormDialog.starsLabel') }}
      q-rating(
        v-model="stars",
        :max="5",
        size="32px",
        color="accent",
        icon="star_border",
        icon-selected="star",
        :aria-label="$t('marketplace.reviewFormDialog.starsLabel')"
      )
    BaseInput(
      v-model="text",
      type="textarea",
      :rows="4",
      autogrow,
      :label="$t('marketplace.reviewFormDialog.textLabel')",
      :hint="$t('marketplace.reviewFormDialog.textHint', { count: text.length, max: TEXT_MAX })",
      :error="text.length > TEXT_MAX ? $t('marketplace.reviewFormDialog.textTooLong', { max: TEXT_MAX }) : undefined"
    )
  template(#footer)
    BaseButton(variant="ghost", :disabled="saving", @click="close") {{ $t('common.action.cancel') }}
    BaseButton(variant="primary", :loading="saving", :disabled="!canSubmit", @click="submit") {{ $t('marketplace.reviewFormDialog.submitAction') }}
</template>

<style scoped lang="scss">
.review-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__offer {
    font-size: var(--p-fs-body);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: var(--p-2);
  }

  &__label {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }
}
</style>
