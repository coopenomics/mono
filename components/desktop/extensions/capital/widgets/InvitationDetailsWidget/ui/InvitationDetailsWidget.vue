<template lang="pug">
.row.q-col-gutter-md
  .col-md-4.col-sm-6.col-xs-12
    ColorCard(color='indigo', size='sm')
      .card-label Исполнитель
      .card-value {{ formatAsset2Digits(`${candidate.contributed_as_creator || 0} ${info.symbols.root_govern_symbol}`) }}

  .col-md-4.col-sm-6.col-xs-12
    ColorCard(color='cyan', size='sm')
      .card-label Соавтор
      .card-value {{ formatAsset2Digits(`${candidate.contributed_as_author || 0} ${info.symbols.root_govern_symbol}`) }}

  .col-md-4.col-sm-6.col-xs-12
    ColorCard(color='orange', size='sm')
      .card-label Координатор
      .card-value {{ formatAsset2Digits(`${candidate.contributed_as_coordinator || 0} ${info.symbols.root_govern_symbol}`) }}

  .col-md-4.col-sm-6.col-xs-12
    ColorCard(color='indigo', size='sm')
      .card-label Взносы имуществом
      .card-value {{ formatAsset2Digits(`${candidate.contributed_as_propertor || 0} ${info.symbols.root_govern_symbol}`) }}

  .col-md-4.col-sm-6.col-xs-12
    ColorCard(color='green', size='sm')
      .card-label Получено по Благоросту
      .card-value {{ formatAsset2Digits(`${candidate.contributed_as_contributor || 0} ${info.symbols.root_govern_symbol}`) }}

</template>

<script lang="ts" setup>
import { useSystemStore } from 'src/entities/System/model';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import type { ICapitalCandidate } from 'app/extensions/capital/entities/Candidate';

interface Props {
  candidate: ICapitalCandidate;
}

defineProps<Props>();
const { info } = useSystemStore();
</script>

<style lang="scss" scoped>
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
