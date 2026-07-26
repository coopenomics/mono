<template lang="pug">
.result-detail
  .result-detail__roles
    .result-detail__role(v-if='segment.is_author')
      .result-detail__role-head
        q-icon(name='edit', size='18px')
        span Соавтор
      .result-detail__rows
        DataRow(
          label='Стоимость профессионального времени',
          :value='formatAmount(segment.author_base)',
          mono
        )
        DataRow(
          label='Стоимость общественно-полезного времени',
          :value='formatAmount(segment.equal_author_bonus)',
          mono
        )

    .result-detail__role(v-if='segment.is_creator')
      .result-detail__role-head
        q-icon(name='engineering', size='18px')
        span Исполнитель
      .result-detail__rows
        DataRow(
          label='Стоимость профессионального времени',
          :value='formatAmount(segment.creator_base)',
          mono
        )
        DataRow(
          label='Стоимость общественно-полезного времени',
          :value='formatAmount(parseFloat(segment.direct_creator_bonus || "0"))',
          mono
        )

    .result-detail__role(v-if='segment.is_coordinator')
      .result-detail__role-head
        q-icon(name='groups', size='18px')
        span Координатор
      .result-detail__rows
        DataRow(
          label='Стоимость профессионального времени',
          :value='formatAmount(segment.coordinator_base)',
          mono
        )

    .result-detail__role(v-if='hasVotingData(segment)')
      .result-detail__role-head
        q-icon(name='how_to_vote', size='18px')
        span Голосование
      .result-detail__rows
        DataRow(
          label='Результат голосования по системе «Компас»',
          :value='formatAmount(segment.voting_bonus)',
          mono
        )

    .result-detail__role(v-if='hasLoansData(segment)')
      .result-detail__role-head
        q-icon(name='account_balance', size='18px')
        span Займы
      .result-detail__rows
        DataRow(
          label='Займ получен',
          :value='formatAmount(segment.debt_amount)',
          mono
        )
        DataRow(
          label='Займ возвращён',
          :value='formatAmount(segment.debt_settled)',
          mono
        )

  .result-detail__preview(v-if='canViewResult')
    .result-detail__role-head
      q-icon(name='description', size='18px')
      span Результат интеллектуальной деятельности
    ResultPreviewCard(
      :username='props.segment.username',
      :project-hash='props.segment.project_hash'
    )
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { ResultPreviewCard } from '../../features/Result/PreviewResult/ui';

interface Props {
  segment: any;
}

const props = defineProps<Props>();

const { info } = useSystemStore();

const canViewResult = computed(() => true);

const formatAmount = (amount: string | number) => {
  const value = parseFloat(amount?.toString() || '0');
  return formatAsset2Digits(`${value} ${info.symbols.root_govern_symbol}`);
};

const hasLoansData = (segment: any) => {
  return (
    parseFloat(segment.debt_amount || '0') > 0 ||
    parseFloat(segment.debt_settled || '0') > 0
  );
};

const hasVotingData = (segment: any) => {
  return segment.has_vote && parseFloat(segment.voting_bonus || '0') > 0;
};
</script>

<style lang="scss" scoped>
.result-detail {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;
}

.result-detail__roles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: var(--p-4);
}

.result-detail__role {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
  min-width: 0;
}

.result-detail__role-head {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2);
  font-weight: 600;
  color: var(--p-ink);

  .q-icon {
    color: var(--p-primary);
  }
}

.result-detail__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);

  :deep(.data-row--horizontal) {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  :deep(.data-row__value-text) {
    white-space: nowrap;
    overflow-wrap: normal;
  }
}

.result-detail__preview {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
  min-width: 0;
}
</style>
