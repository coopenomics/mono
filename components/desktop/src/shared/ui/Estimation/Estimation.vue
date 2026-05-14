<template lang="pug">
div
  // Микро-компонент для отображения факта и оценки задачи
  //   - если fact задан (и > 0) — показываем прогресс-бар "fact / estimation"
  //   - если задан только estimation — легаси-режим, одна метка
  //   - ничего не показываем, если оба пусты
  .time-progress-display(
    v-if='showProgress'
    :class='sizeClass'
    :title='tooltipText'
  )
    .time-progress-label
      q-icon(
        v-if='!noIcon'
        name='schedule'
        size='xs'
        :color='progressColor'
      ).q-mr-xs
      span.time-progress-text {{ progressText }}
    q-linear-progress(
      :value='progressValue'
      :color='progressColor'
      track-color='grey-3'
      size='3px'
      rounded
      style='width: 100%; max-width: 90px; margin-top: 2px'
    )
  .estimation-display(
    v-else-if='estimation != null && !Number.isNaN(estimation) && estimation > 0'
    :class='sizeClass'
  )
    q-icon(
      v-if='!noIcon'
      name='schedule',
      size='xs'
      color='grey-6'
    ).q-mr-xs
    span.estimation-text {{ formattedEstimation }}
</template>

<script lang="ts" setup>
import { computed } from 'vue';

// Микро-компонент для отображения факта/оценки задачи в часах или днях.
// Если передан fact — рендерится мини-прогресс-бар fact/estimation.

const props = defineProps<{
  estimation?: number; // План в часах (может быть 0 = «оценки нет»)
  fact?: number; // Фактически накопленное время в часах (сумма TimeEntry)
  size?: 'xs' | 'sm' | 'md';
  noIcon?: boolean; // Скрыть значок-часы (для встраивания в плотные строки списка)
}>();

function formatHours(hours: number | undefined | null): string {
  if (hours == null || Number.isNaN(hours) || hours <= 0) return '0ч';
  if (hours < 8) {
    const rounded = hours % 1 === 0 ? hours : parseFloat(hours.toFixed(2));
    return `${rounded}ч`;
  }
  const days = Math.round((hours / 8) * 10) / 10;
  return `${days}д`;
}

const formattedEstimation = computed(() => formatHours(props.estimation));

const hasFact = computed(
  () => props.fact != null && !Number.isNaN(props.fact) && props.fact > 0
);
const hasEstimate = computed(
  () => props.estimation != null && !Number.isNaN(props.estimation) && props.estimation > 0
);

// Показываем прогресс-бар, если есть хотя бы одно из значений (fact или estimate).
// Когда fact есть, но estimate пуст — бар становится серым индикатором (без плана).
const showProgress = computed(() => hasFact.value);

const progressText = computed(() => {
  const factStr = formatHours(props.fact);
  if (hasEstimate.value) return `${factStr} / ${formattedEstimation.value}`;
  return factStr;
});

const progressValue = computed(() => {
  if (!hasEstimate.value) return 0; // индикатор без плана — просто подсветка
  const ratio = (props.fact ?? 0) / (props.estimation ?? 1);
  return Math.min(1, Math.max(0, ratio));
});

// Зелёный — в пределах плана, оранжевый — перебор, серый — плана нет.
const progressColor = computed(() => {
  if (!hasEstimate.value) return 'grey-6';
  const fact = props.fact ?? 0;
  const est = props.estimation ?? 0;
  if (fact > est + 1e-6) return 'orange-7';
  return 'teal-7';
});

const tooltipText = computed(() => {
  if (!hasFact.value) return '';
  if (hasEstimate.value) {
    return `Отработано ${formatHours(props.fact)} из ${formattedEstimation.value} запланированных`;
  }
  return `Отработано ${formatHours(props.fact)} (плана нет)`;
});

// Класс для размера
const sizeClass = computed(() => {
  return `estimation-${props.size || 'sm'}`;
});
</script>

<style lang="scss" scoped>
.estimation-display,
.time-progress-display {
  display: inline-flex;
  flex-direction: column;
  color: var(--q-grey-6);
  font-size: 12px;
  font-weight: 500;
  min-width: 0;
  max-width: 100%;

  &.estimation-xs {
    font-size: 11px;
  }

  &.estimation-sm {
    font-size: 12px;
  }

  &.estimation-md {
    font-size: 13px;
  }

  .estimation-text,
  .time-progress-text {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .time-progress-label {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
}

.estimation-display {
  flex-direction: row;
  align-items: center;
  gap: 2px;
}
</style>
