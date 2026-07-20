<template lang="pug">
q-card(flat, style='margin-top: 8px;')

  // Основные группы
  .row
    .col-md-6.col-12(v-if='segment.is_author')
      // Соавтор

      q-card-section
        .row.justify-center.items-center.q-mb-sm
          .col-auto.q-pr-sm
            q-icon(name='edit', size='md', color='purple')
          .col-auto
            .text-h6 Соавтор
        .q-pa-sm
          ColorCard(color='blue')
            .card-label Стоимость профессионального времени
            .card-value {{ formatAmount(segment.author_base) }}
          ColorCard(color='blue')
            .card-label Стоимость общественно-полезного времени
            .card-value {{ formatAmount(segment.equal_author_bonus) }}

    // Правая колонка
    .col-md-6.col-12(v-if='segment.is_creator')
      // Исполнитель
      q-card-section
        .row.justify-center.items-center.q-mb-sm
          .col-auto.q-pr-sm
            q-icon(name='engineering', size='md', color='blue')
          .col-auto
            .text-h6 Исполнитель
        .q-pa-sm
          ColorCard(color='blue')
            .card-label Стоимость профессионального времени
            .card-value {{ formatAmount(segment.creator_base) }}
          ColorCard(color='blue')
            .card-label Стоимость общественно-полезного времени
            .card-value {{ formatAmount(parseFloat(segment.direct_creator_bonus || '0')) }}
    //- .col-md-6.col-12(v-if='segment.is_investor')
      //- // Инвестор
      //- q-card-section
      //-   .row.justify-center.items-center.q-mb-sm
      //-     .col-auto.q-pr-sm
      //-       q-icon(name='trending_up', size='md', color='green')
      //-     .col-auto
      //-       .text-h6 Инвестор
      //-   .q-pa-sm
      //-     ColorCard(color='green')
      //-       .card-label Денежный взнос
      //-       .card-value {{ formatAmount(segment.investor_base) }}
      //-     ColorCard(color='green')
      //-       .card-label Имущественный взнос
      //-       .card-value {{ formatAmount(segment.property_base) }}
    .col-md-6.col-12(v-if='segment.is_coordinator')
      // Координатор
      q-card-section
        .row.justify-center.items-center.q-mb-sm
          .col-auto.q-pr-sm
            q-icon(name='groups', size='md', color='indigo')
          .col-auto
            .text-h6 Координатор
        .q-pa-sm
          ColorCard(color='blue')
            .card-label Стоимость профессионального времени
            .card-value {{ formatAmount(segment.coordinator_base) }}

    .col-md-6.col-12(v-if='hasVotingData(segment)')
      // Займы и голосование
      q-card-section
        .row.justify-center.items-center.q-mb-sm
          .col-auto.q-pr-sm
            q-icon(name='how_to_vote', size='md', color='cyan')
          .col-auto
            .text-h6 Голосование
        .q-pa-sm
          ColorCard(v-if='hasVotingData(segment)', color='blue')
            .card-label Результат голосования по системе "Компас"
            .card-value {{ formatAmount(segment.voting_bonus) }}

    .col-md-6.col-12(v-if='hasLoansData(segment)')
      // Займы и голосование
      q-card-section
        .row.justify-center.items-center.q-mb-sm
          .col-auto.q-pr-sm
            q-icon(name='how_to_vote', size='md', color='cyan')
          .col-auto
            .text-h6 Займы
        .q-pa-sm
          ColorCard(v-if='hasLoansData(segment)', color='cyan')
            .card-label Займ получен
            .card-value {{ formatAmount(segment.debt_amount) }}
          ColorCard(v-if='hasLoansData(segment)', color='cyan')
            .card-label Займ возвращен
            .card-value {{ formatAmount(segment.debt_settled) }}

    //- .col-md-6.col-12(v-if='segment.is_contributor')
    //-   // Участник
    //-   q-card-section
    //-     .row.justify-center.items-center.q-mb-sm
    //-       .col-auto.q-pr-sm
    //-         q-icon(name='stars', size='md', color='teal')
    //-       .col-auto
    //-         .text-h6 Ранний участник
    //-     .q-pa-sm
    //-       ColorCard(color='teal')
    //-         .card-label Стоимость общественно-полезного времени
    //-         .card-value {{ formatAmount(segment.contributor_bonus) }}

  // Просмотр результата интеллектуальной деятельности
  ColorCard(color='blue' v-if='canViewResult')
    ResultPreviewCard(
      :username='props.segment.username',
      :project-hash='props.segment.project_hash'
    )



</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { useSystemStore } from 'src/entities/System/model';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { ResultPreviewCard } from '../../features/Result/PreviewResult/ui';

interface Props {
  segment: any;
}

const props = defineProps<Props>();

const { info } = useSystemStore();

// Computed свойство для определения возможности просмотра результата
const canViewResult = computed(() => {
  return true
  // return props.segment.username &&
  //        props.segment.project_hash &&
  //        (props.segment.username === session.username || session.isChairman || session.isMember);
});

// Форматирование суммы с двумя знаками после запятой
const formatAmount = (amount: string | number) => {
  const value = parseFloat(amount?.toString() || '0');
  return formatAsset2Digits(`${value} ${info.symbols.root_govern_symbol}`);
};

// Проверка наличия займов
const hasLoansData = (segment: any) => {
  return parseFloat(segment.debt_amount || '0') > 0 || parseFloat(segment.debt_settled || '0') > 0;
};

// Проверка наличия данных голосования
const hasVotingData = (segment: any) => {
  return segment.has_vote && parseFloat(segment.voting_bonus || '0') > 0;
};
</script>

<style lang="scss" scoped>
// Ограничиваем ширину виджета и всех дочерних элементов
q-card {
  max-width: 100%;
  overflow: hidden;
}

// Убеждаемся, что все вложенные элементы не выходят за пределы
:deep(*) {
  max-width: 100%;
  box-sizing: border-box;
}

.card-value {
  font-size: 16px;
  font-weight: 500;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}

.card-label {
  font-size: var(--p-fs-body);
  color: var(--p-ink-2);
  margin-bottom: var(--p-1);
}
</style>
