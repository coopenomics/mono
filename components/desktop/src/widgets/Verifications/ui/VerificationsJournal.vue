<template lang="pug">
//- Журнал верификаций личности. В цепи истории нет — вектор подтверждений
//- хранит только текущее состояние, а отзыв запись стирает. Поэтому «кто,
//- где и когда сверял» ведёт сам кооператив, и история идёт с внедрения.
.verifications
  BaseBanner(v-if='pending.length', variant='info')
    | Сверок ждёт решения: {{ pending.length }}. Пайщик уже получает имущество —
    | отклонение отзовёт подтверждение личности.

  BaseTable(
    :columns='columns',
    :rows='reviews',
    row-key='id',
    :loading='loading',
    min-width='860px',
    sort-by='created_at',
    descending
  )
    template(#cell-username='{ row }')
      .verifications__who
        .verifications__name {{ participantName(row.username) || row.username }}
        AccountBadge(:account-name='row.username', size='sm')

    template(#cell-place='{ row }') {{ placeName(row.braname) }}

    template(#cell-verificator='{ row }') {{ participantName(row.verificator) || row.verificator }}

    template(#cell-created_at='{ row }') {{ formatDateToHumanDateTime(row.created_at) }}

    template(#cell-status='{ row }')
      .verifications__status
        BaseBadge(:variant='statusView(row.status).variant') {{ statusView(row.status).label }}
        .verifications__decision(v-if='row.decided_by')
          | {{ decisionLine(row) }}

    template(#cell-actions='{ row }')
      BaseButton(
        v-if='row.status === PENDING',
        variant='secondary',
        size='sm',
        :loading='deciding === row.id',
        @click='openReview(row)'
      )
        template(#icon-left)
          q-icon(name='fact_check', size='16px')
        | Проверить

  EmptyState(
    v-if='!loading && !reviews.length',
    title='Журнал пуст',
    body='Здесь появятся сверки личности, как только их проведут на кооперативных участках или в совете.'
  )

  VerificationReviewDialog(
    v-model='reviewOpen',
    :review='selected',
    :full-name='selected ? participantName(selected.username) : ""',
    :verificator-name='selected ? participantName(selected.verificator) || selected.verificator : ""',
    :place-name='selected ? placeName(selected.braname) : ""',
    :busy='Boolean(deciding)',
    :load-photos='loadPhotos',
    @approve='onApprove',
    @reject='onReject'
  )
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge, BaseBanner, BaseButton, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable';
import { AccountBadge } from 'src/shared/ui/domain';
import { formatDateToHumanDateTime } from 'src/shared/lib/utils/dates';
import type { VerificationNaming } from 'src/shared/lib/verification';
import type { IVerificationReview } from '../api';
import { useVerificationReviews, verificationReviewStatusView } from '../model';

const PENDING = Zeus.VerificationReviewStatus.Pending;

const props = defineProps<{
  /** Человеческие имена пайщиков и участков — служебные id в журнале не нужны. */
  naming?: VerificationNaming;
}>();

const emit = defineEmits<{
  /** Решение совета меняет уровни пайщика — реестр надо перечитать. */
  (e: 'changed'): void;
}>();

const { reviews, pending, loading, deciding, load, loadPhotos, approve, reject } =
  useVerificationReviews();

const reviewOpen = ref(false);
const selected = ref<IVerificationReview | null>(null);

const columns: BaseTableColumn<IVerificationReview>[] = [
  { key: 'username', label: 'Пайщик', width: '220px' },
  { key: 'place', label: 'Где сверяли', width: '180px' },
  { key: 'verificator', label: 'Кто сверял', width: '180px' },
  { key: 'created_at', label: 'Когда', width: '160px', sortable: true },
  { key: 'status', label: 'Состояние', width: '200px' },
  { key: 'actions', label: '', width: '140px', align: 'right' },
];

const statusView = verificationReviewStatusView;

const participantName = (username: string): string => props.naming?.attestorName?.(username) || '';

const placeName = (braname: string): string =>
  braname ? `Участок «${props.naming?.branchName?.(braname) || braname}»` : 'Совет кооператива';

/** Строка решения: кто закрыл сверку и почему, если отклонил или отозвал. */
const decisionLine = (review: IVerificationReview): string => {
  const who = participantName(review.decided_by ?? '') || review.decided_by;
  const when = review.decided_at ? formatDateToHumanDateTime(review.decided_at) : '';
  const reason = review.decision_reason ? ` — ${review.decision_reason}` : '';
  return `${who}${when ? `, ${when}` : ''}${reason}`;
};

const openReview = (review: IVerificationReview) => {
  selected.value = review;
  reviewOpen.value = true;
};

const onApprove = async (reviewId: string) => {
  if (await approve(reviewId)) {
    reviewOpen.value = false;
    emit('changed');
  }
};

const onReject = async (reviewId: string, reason: string) => {
  if (await reject(reviewId, reason)) {
    reviewOpen.value = false;
    emit('changed');
  }
};

onMounted(load);

defineExpose({ reload: load, pending });
</script>

<style scoped lang="scss">
.verifications {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

.verifications__who {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
}

.verifications__name {
  font-weight: 500;
  color: var(--p-ink);
}

.verifications__status {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
  align-items: flex-start;
}

.verifications__decision {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-3);
}
</style>
