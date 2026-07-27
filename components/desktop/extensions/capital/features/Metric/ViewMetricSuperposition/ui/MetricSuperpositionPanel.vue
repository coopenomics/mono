<template lang="pug">
.superposition
  .superposition__head
    .superposition__title Суперпозиция метрик
    BaseSelect(
      v-model='period',
      :options='periodOptions',
      label='Период'
    )

  .superposition__summary(v-if='data')
    .superposition__stat
      .superposition__stat-val.t-mono {{ data.up_count }}
      .superposition__stat-lbl вверх
    .superposition__stat
      .superposition__stat-val.t-mono {{ data.down_count }}
      .superposition__stat-lbl вниз
    .superposition__stat
      .superposition__stat-val.t-mono {{ data.flat_count }}
      .superposition__stat-lbl нейтрально
    .superposition__stat.superposition__stat--wide
      .superposition__stat-val.t-mono {{ data.fact_sum }} / {{ data.target_sum }}
      .superposition__stat-lbl rollup факт / цель

  .superposition__components(
    v-if='data && data.components.length > 1'
  )
    .superposition__sec-title Компоненты
    .superposition__comp(
      v-for='c in data.components',
      :key='c.project_hash'
    )
      .superposition__comp-title {{ c.project_title }}
      .superposition__comp-meta.t-mono
        | {{ c.metrics_count }} метр. · {{ c.fact_sum }} / {{ c.target_sum }}

  .superposition__list(v-if='data && data.items.length')
    .superposition__sec-title Метрики
    .superposition__item(
      v-for='item in data.items',
      :key='item.metric_hash'
    )
      .superposition__item-drive(
        :class='driveClass(item.drive)'
      ) {{ driveLabel(item.drive) }}
      .superposition__item-body
        .superposition__item-title {{ item.title }}
        .superposition__item-meta
          span {{ item.project_title }}
          span.t-mono · волна {{ labelOf(item.current_label) }}
          span.t-mono · Δ {{ formatDelta(item.recent_velocity) }}
        .superposition__item-progress
          span.t-mono {{ item.fact }} / {{ item.target_value }} {{ item.unit }}

  .superposition__empty(v-else-if='!isLoading && data && !data.items.length')
    EmptyState(title='Нет активных метрик для суперпозиции')
      template(#icon)
        q-icon(name='hub', size='28px')

  .superposition__disclaimer(v-if='data')
    q-icon(name='info', size='14px')
    span {{ data.disclaimer }}

  .superposition__skel(v-if='isLoading')
    .skel(v-for='i in 3', :key='i')
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseSelect, EmptyState } from 'src/shared/ui/base';
import { useMetricSuperposition } from '../model';

const props = defineProps<{
  projectHash: string;
}>();

const projectHashRef = toRef(props, 'projectHash');
const { data, isLoading, period } = useMetricSuperposition(() => projectHashRef.value);

const periodOptions = [
  { label: 'День', value: Zeus.MetricSeriesPeriod.DAY },
  { label: 'Неделя', value: Zeus.MetricSeriesPeriod.WEEK },
  { label: 'Месяц', value: Zeus.MetricSeriesPeriod.MONTH },
];

const driveLabel = (d: Zeus.MetricDriveDirection) => {
  if (d === Zeus.MetricDriveDirection.UP) return '↑';
  if (d === Zeus.MetricDriveDirection.DOWN) return '↓';
  return '·';
};

const driveClass = (d: Zeus.MetricDriveDirection) => ({
  'superposition__item-drive--up': d === Zeus.MetricDriveDirection.UP,
  'superposition__item-drive--down': d === Zeus.MetricDriveDirection.DOWN,
  'superposition__item-drive--flat': d === Zeus.MetricDriveDirection.FLAT,
});

const labelOf = (raw: string) => raw.replace(/^W/, '');
const formatDelta = (d: number) => (d > 0 ? `+${d}` : `${d}`);
</script>

<style lang="scss" scoped>
.superposition {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.superposition__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--p-3);
}

.superposition__title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}

.superposition__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3);
}

.superposition__stat {
  min-width: 64px;
}

.superposition__stat--wide {
  min-width: 120px;
}

.superposition__stat-val {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}

.superposition__stat-lbl {
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
}

.superposition__sec-title {
  font-size: var(--p-fs-caption);
  font-weight: 500;
  color: var(--p-ink-2);
  margin-bottom: var(--p-1);
}

.superposition__components,
.superposition__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.superposition__comp {
  display: flex;
  justify-content: space-between;
  gap: var(--p-2);
  padding: var(--p-2) var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}

.superposition__comp-title {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink);
}

.superposition__comp-meta {
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
}

.superposition__item {
  display: flex;
  gap: var(--p-3);
  padding: var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  align-items: flex-start;
}

.superposition__item-drive {
  width: 28px;
  height: 28px;
  border-radius: var(--p-r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.superposition__item-drive--up {
  color: var(--p-pos);
  background: var(--p-pos-soft);
}

.superposition__item-drive--down {
  color: var(--p-neg);
  background: var(--p-neg-soft);
}

.superposition__item-drive--flat {
  color: var(--p-ink-3);
  background: var(--p-surface-2);
}

.superposition__item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.superposition__item-title {
  font-size: var(--p-fs-body-sm);
  font-weight: 500;
  color: var(--p-ink);
}

.superposition__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-1);
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
}

.superposition__item-progress {
  font-size: var(--p-fs-caption);
  color: var(--p-ink-2);
}

.superposition__disclaimer {
  display: flex;
  gap: var(--p-1);
  align-items: flex-start;
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
  line-height: 1.35;
}

.superposition__skel .skel {
  height: 48px;
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}
</style>
