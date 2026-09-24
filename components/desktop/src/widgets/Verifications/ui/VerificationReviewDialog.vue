<template lang="pug">
//- Проверка сверки, проведённой на кооперативном участке: председатель совета
//- смотрит фотографии и решает. Утвердил — снимки удаляются, уровень остаётся.
//- Отклонил — верификация отзывается, и пайщик снова не получит имущество.
BaseDialog(
  :model-value='modelValue',
  :title='$t("verification.verificationReviewDialog.title")',
  size='md',
  @update:model-value='(value) => emit("update:modelValue", value)'
)
  .review-dialog(v-if='review')
    .review-dialog__name {{ fullName || review.username }}
    AccountBadge(:account-name='review.username', size='sm')

    .review-dialog__facts
      DataRow(:label='$t("verification.verificationReviewDialog.verifiedByLabel")', :value='verificatorName')
      DataRow(:label='$t("verification.verificationReviewDialog.placeLabel")', :value='placeName')
      DataRow(:label='$t("verification.verificationReviewDialog.dateLabel")', :value='formatDateToHumanDateTime(review.created_at)')

    .review-dialog__photos
      .review-dialog__photos-title {{ $t('verification.verificationReviewDialog.photosTitle') }}
      .review-dialog__grid(v-if='loadingPhotos')
        q-skeleton(type='rect', height='160px')
        q-skeleton(type='rect', height='160px')
      .review-dialog__grid(v-else-if='photos.length')
        a.review-dialog__photo(
          v-for='photo in photos',
          :key='photo.storage_key',
          :href='photo.read_url',
          target='_blank',
          rel='noopener'
        )
          img(:src='photo.read_url', :alt='$t(`verification.verificationReviewDialog.photoAlt`, { username: review.username })')
      .review-dialog__empty(v-else) {{ $t('verification.verificationReviewDialog.photosUnavailable') }}

    BaseInput(
      v-model='reason',
      :label='$t("verification.verificationReviewDialog.rejectReasonLabel")',
      :hint='$t("verification.verificationReviewDialog.rejectReasonHint")',
      :disabled='busy'
    )

    .review-dialog__actions
      BaseButton(variant='ghost', :disabled='busy', @click='emit("update:modelValue", false)') {{ $t('common.action.close') }}
      BaseButton(variant='danger', :loading='busy', :disabled='!reason.trim()', @click='onReject')
        template(#icon-left)
          q-icon(name='person_off', size='16px')
        | {{ $t('verification.verificationReviewDialog.reject') }}
      BaseButton(variant='primary', :loading='busy', @click='onApprove')
        template(#icon-left)
          q-icon(name='how_to_reg', size='16px')
        | {{ $t('verification.verificationReviewDialog.approve') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { AccountBadge, DataRow } from 'src/shared/ui/domain';
import { formatDateToHumanDateTime } from 'src/shared/lib/utils/dates';
import type { IVerificationReview, IVerificationReviewPhoto } from '../api';

const props = defineProps<{
  modelValue: boolean;
  /** Проверяемая запись журнала; null — окно закрыто. */
  review: IVerificationReview | null;
  /** ФИО пайщика — служебный account-id в заголовке не показываем. */
  fullName?: string;
  /** Человеческое имя того, кто сверял. */
  verificatorName?: string;
  /** Где сверяли: название участка либо «совет кооператива». */
  placeName?: string;
  /** Идёт решение — кнопки заблокированы. */
  busy?: boolean;
  /** Загрузчик снимков: ссылки живут минуты, поэтому берём их на открытие. */
  loadPhotos: (reviewId: string) => Promise<IVerificationReviewPhoto[]>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'approve', reviewId: string): void;
  (e: 'reject', reviewId: string, reason: string): void;
}>();

const photos = ref<IVerificationReviewPhoto[]>([]);
const loadingPhotos = ref(false);
const reason = ref('');

const reviewId = computed(() => props.review?.id ?? '');

watch(
  [() => props.modelValue, reviewId],
  async ([open, id]) => {
    if (!open || !id) {
      photos.value = [];
      reason.value = '';
      return;
    }
    loadingPhotos.value = true;
    try {
      photos.value = await props.loadPhotos(id);
    } finally {
      loadingPhotos.value = false;
    }
  },
  { immediate: true },
);

const onApprove = () => {
  if (reviewId.value) emit('approve', reviewId.value);
};

const onReject = () => {
  if (reviewId.value) emit('reject', reviewId.value, reason.value.trim());
};
</script>

<style scoped lang="scss">
.review-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.review-dialog__name {
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-weight: 600;
  color: var(--p-ink);
}

.review-dialog__facts {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
}

.review-dialog__photos {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}

.review-dialog__photos-title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}

.review-dialog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--p-2, 8px);
}

.review-dialog__photo {
  display: block;
  overflow: hidden;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-surface-2);

  img {
    display: block;
    width: 100%;
    height: 160px;
    object-fit: cover;
  }
}

.review-dialog__empty {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.review-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2, 8px);
  margin-top: var(--p-2, 8px);
}
</style>
