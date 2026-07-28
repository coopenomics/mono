<template lang="pug">
.superposition
  .superposition__head
    .superposition__head-left
      .superposition__title Суперпозиция метрик
      BaseButton.superposition__help-btn(
        variant='ghost',
        size='sm',
        :icon-only='true',
        type='button',
        aria-label='Справка о суперпозиции',
        @click='helpOpen = true'
      )
        template(#icon-left)
          q-icon(name='help_outline', size='18px')

  template(v-if='lastFrameHasItems && data')
    .superposition__stats
      .superposition__stat(
        v-for='stat in stats',
        :key='stat.key'
      )
        .superposition__stat-val.t-mono {{ stat.value }}
        .superposition__stat-lbl
          q-icon.superposition__stat-ico(
            :name='stat.icon',
            size='14px'
          )
          span {{ stat.label }}
          q-icon.superposition__stat-help(
            name='help_outline',
            size='14px'
          )
            q-tooltip(
              anchor='top middle',
              self='bottom middle',
              :offset='[0, 6]',
              max-width='280px'
            ) {{ stat.hint }}
      .superposition__stat.superposition__stat--main
        .superposition__stat-val.t-mono {{ pct(score) }}
        .superposition__stat-lbl
          q-icon.superposition__stat-ico(
            :name='STAT_ICONS.score',
            size='14px'
          )
          span Суперпозиция
          q-icon.superposition__stat-help(
            name='help_outline',
            size='14px'
          )
            q-tooltip(
              anchor='top middle',
              self='bottom middle',
              :offset='[0, 6]',
              max-width='300px'
            ) {{ scoreHint }}

    .superposition__body
      .superposition__history
        SuperpositionHistoryChart(
          :frames='frames',
          :frame-index='frameIndex',
          :period='period',
          @select='onChartSelect'
        )
      .superposition__stage(
        ref='stageRef',
        @pointermove='onStageMove',
        @pointerdown='onStageMove',
        @mouseleave='hideTip'
      )
        SuperpositionTargetChart.superposition__chart(
          :sectors='sectors',
          :core-fill='coreFill',
          :aria-label='ariaLabel',
          @sector-enter='showSectorTip',
          @core-enter='showCoreTip'
        )
        .superposition__tip(
          v-if='tip',
          :style='tipStyle'
        )
          .superposition__tip-title {{ tip.title }}
          .superposition__tip-row(
            v-for='row in tip.rows',
            :key='row.label'
          )
            q-icon.superposition__tip-ico(
              :name='row.icon',
              size='16px'
            )
            span.superposition__tip-label {{ row.label }}
            span.superposition__tip-value.t-mono {{ row.value }}

    .superposition__footer
      SuperpositionTimelineScrubber(
        v-if='frames.length > 1',
        v-model='frameIndex',
        :max-index='frames.length - 1',
        :label='frameLabel'
      )
      .superposition__footer-spacer(v-else)
      .superposition__period
        BaseSelect(
          v-model='period',
          :options='periodOptions',
          placeholder='Период'
        )

  .superposition__empty(v-else-if='!isLoading')
    EmptyState(title='Нет активных метрик для суперпозиции')
      template(#icon)
        q-icon(name='hub', size='28px')

  .superposition__skel(v-if='isLoading')
    .skel

  SuperpositionHelpDialog(v-model='helpOpen')
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useQuasar } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { BaseButton, BaseSelect, EmptyState } from 'src/shared/ui/base';
import { useMetricSuperposition } from '../model';
import {
  buildPolarSectors,
  softHeatColor,
  superpositionScore,
  type PolarSector,
} from '../lib/superpositionPolar';
import SuperpositionHelpDialog from './SuperpositionHelpDialog.vue';
import SuperpositionHistoryChart from './SuperpositionHistoryChart.vue';
import SuperpositionTargetChart from './SuperpositionTargetChart.vue';
import SuperpositionTimelineScrubber from './SuperpositionTimelineScrubber.vue';

const props = defineProps<{
  projectHash: string;
}>();

const $q = useQuasar();
const projectHashRef = toRef(props, 'projectHash');
const { data, frames, frameIndex, isLoading, period } = useMetricSuperposition(
  () => projectHashRef.value,
);
const helpOpen = ref(false);

const periodOptions = [
  { label: '1 мин', value: Zeus.MetricSeriesPeriod.MINUTE },
  { label: '5 мин', value: Zeus.MetricSeriesPeriod.MINUTE_5 },
  { label: '15 мин', value: Zeus.MetricSeriesPeriod.MINUTE_15 },
  { label: 'Час', value: Zeus.MetricSeriesPeriod.HOUR },
  { label: 'День', value: Zeus.MetricSeriesPeriod.DAY },
  { label: 'Неделя', value: Zeus.MetricSeriesPeriod.WEEK },
  { label: 'Месяц', value: Zeus.MetricSeriesPeriod.MONTH },
];

const onChartSelect = (index: number) => {
  frameIndex.value = index;
};

const frameLabel = computed(() => {
  const list = frames.value;
  if (!list.length) return '';
  const idx = Math.max(0, Math.min(frameIndex.value, list.length - 1));
  const at = list[idx]?.at;
  if (!at) return '';
  const d = new Date(at);
  const p = period.value;
  const fine =
    p === Zeus.MetricSeriesPeriod.MINUTE ||
    p === Zeus.MetricSeriesPeriod.MINUTE_5 ||
    p === Zeus.MetricSeriesPeriod.MINUTE_15 ||
    p === Zeus.MetricSeriesPeriod.HOUR;
  if (fine) {
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
});

const lastFrameHasItems = computed(() => {
  const list = frames.value;
  if (!list.length) return false;
  return (list[list.length - 1]?.items.length ?? 0) > 0;
});

const CX = 160;
const CY = 160;
const MAX_R = 118;
const INNER_R = 18;

const stageRef = ref<HTMLElement | null>(null);
const tip = ref<{
  title: string;
  rows: { icon: string; label: string; value: string }[];
} | null>(null);
const tipX = ref(0);
const tipY = ref(0);

const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

const STAT_ICONS = {
  balance: 'balance',
  growth: 'trending_up',
  activity: 'speed',
  score: 'hub',
  force: 'bolt',
} as const;

const isDark = computed(() => {
  void $q.dark.isActive;
  return $q.dark.isActive;
});

const glow = computed(() => {
  const d = data.value;
  if (!d) return 0;
  return Math.max(0, Math.min(1, d.growth * 0.7 + d.activity * 0.3));
});

const score = computed(() => {
  const d = data.value;
  if (!d) return 0;
  return superpositionScore(d.balance, d.growth, d.activity);
});

const scoreHint =
  'Сводный резонанс системы: живое согласованное движение к целям. Растёт, когда есть движение, рост не ниже нуля и баланс близок к 100%. Ноль — нет живого согласованного продвижения.';

const coreFill = computed(() =>
  softHeatColor(Math.min(1, Math.max(glow.value, score.value) * 0.75 + 0.2), isDark.value),
);

const sectors = computed(() => {
  const d = data.value;
  if (!d?.items.length) return [];
  void isDark.value;
  return buildPolarSectors(
    d.items.map((i) => ({
      metric_hash: i.metric_hash,
      title: i.title,
      amplitude: i.amplitude,
      phase_rad: i.phase_rad,
    })),
    {
      cx: CX,
      cy: CY,
      maxR: MAX_R,
      innerR: INNER_R,
      growth: d.growth,
      activity: d.activity,
      dark: isDark.value,
    },
  );
});

const stats = computed(() => {
  const d = data.value;
  if (!d) return [];
  return [
    {
      key: 'balance',
      icon: STAT_ICONS.balance,
      label: 'Баланс',
      value: pct(d.balance),
      hint:
        'Согласованность направлений: метрики в одной фазе усиливают друг друга, в противофазе — гасят. 100% — все тянут в одну сторону (или тишина, когда никто не тянет). Ниже — часть идёт к цели, часть от неё.',
    },
    {
      key: 'growth',
      icon: STAT_ICONS.growth,
      label: 'Рост',
      value: pct(d.growth),
      hint:
        'Доля движения к целям. 0% — к целям сейчас не продвигаемся. Чем выше — тем сильнее общее движение вперёд.',
    },
    {
      key: 'activity',
      icon: STAT_ICONS.activity,
      label: 'Движение',
      value: pct(d.activity),
      hint:
        'Есть ли сейчас изменения по метрикам. 0% — тишина. Выше — метрики менялись: зелёный сектор — к цели, красный — от цели.',
    },
  ];
});

const tipStyle = computed(() => ({
  left: `${tipX.value}px`,
  top: `${tipY.value}px`,
}));

const showSectorTip = (sector: PolarSector) => {
  tip.value = {
    title: sector.title,
    rows: [
      {
        icon: STAT_ICONS.activity,
        label: 'Движение',
        value: pct(sector.amplitude),
      },
      {
        icon: STAT_ICONS.growth,
        label: 'Рост',
        value: sector.isCorrection ? 'от цели' : 'к цели',
      },
      {
        icon: STAT_ICONS.force,
        label: 'Сила влияния',
        value: `${Math.round(sector.share * 100)}%`,
      },
    ],
  };
};

const showCoreTip = () => {
  const d = data.value;
  if (!d) {
    tip.value = null;
    return;
  }
  tip.value = {
    title: 'Сводка среза',
    rows: [
      {
        icon: STAT_ICONS.score,
        label: 'Суперпозиция',
        value: pct(score.value),
      },
      {
        icon: STAT_ICONS.balance,
        label: 'Баланс',
        value: pct(d.balance),
      },
      {
        icon: STAT_ICONS.growth,
        label: 'Рост',
        value: pct(d.growth),
      },
      {
        icon: STAT_ICONS.activity,
        label: 'Движение',
        value: pct(d.activity),
      },
    ],
  };
};

const onStageMove = (e: PointerEvent | MouseEvent) => {
  const el = stageRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  tipX.value = e.clientX - rect.left + 12;
  tipY.value = e.clientY - rect.top + 12;
};

const hideTip = () => {
  tip.value = null;
};

const ariaLabel = computed(() => {
  const d = data.value;
  if (!d) return 'Мишень суперпозиции';
  return `Суперпозиция ${pct(score.value)}. Баланс ${pct(d.balance)}, рост ${pct(d.growth)}, движение ${pct(d.activity)}`;
});
</script>

<style lang="scss" scoped>
.superposition {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-3) var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}

.superposition__head {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}

.superposition__head-left {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  min-width: 0;
}

.superposition__title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}

.superposition__help-btn {
  flex-shrink: 0;
}

.superposition__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--p-2);
}

.superposition__stat {
  padding: var(--p-2) var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
}

.superposition__stat--main {
  border-color: var(--p-primary);
  background: var(--p-primary-soft);
}

.superposition__stat--main .superposition__stat-val {
  color: var(--p-primary);
}

.superposition__stat--main .superposition__stat-lbl {
  color: var(--p-ink-2);
  font-weight: 600;
}

.superposition__stat-val {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}

.superposition__stat-lbl {
  margin-top: var(--p-1);
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
}

.superposition__stat-ico {
  color: var(--p-ink-3);
  flex-shrink: 0;
}

.superposition__stat--main .superposition__stat-ico {
  color: var(--p-primary);
}

.superposition__stat-help {
  color: var(--p-ink-3);
  cursor: help;
  flex-shrink: 0;
}

.superposition__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--p-3);
  align-items: stretch;
}

.superposition__history {
  min-width: 0;
  min-height: 320px;
  padding: var(--p-2);
  background: var(--p-surface-2);
  border-radius: var(--p-r-md);
  border: 1px solid var(--p-line);
  display: flex;
  align-items: stretch;
}

.superposition__stage {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 0;
  min-height: 320px;
  padding: var(--p-3);
  background: var(--p-surface-2);
  border-radius: var(--p-r-md);
  border: 1px solid var(--p-line);
  -webkit-tap-highlight-color: transparent;
  user-select: none;

  :deep(svg),
  :deep(path),
  :deep(circle) {
    outline: none !important;
  }
}

.superposition__chart {
  width: min(100%, 320px);
  max-width: 320px;
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .superposition__body {
    grid-template-columns: 1fr;
  }
}

.superposition__tip {
  position: absolute;
  z-index: 2;
  min-width: 180px;
  max-width: 260px;
  padding: var(--p-2) var(--p-3);
  border-radius: var(--p-r-sm);
  border: 1px solid var(--p-line);
  background: var(--p-surface);
  color: var(--p-ink);
  font-size: var(--p-fs-caption);
  line-height: var(--p-lh-caption, 1.35);
  box-shadow: var(--p-shadow-pop, 0 8px 24px rgba(0, 0, 0, 0.18));
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.superposition__tip-title {
  font-weight: 600;
  color: var(--p-ink);
  padding-bottom: var(--p-1);
  border-bottom: 1px solid var(--p-line);
}

.superposition__tip-row {
  display: grid;
  grid-template-columns: 16px 1fr auto;
  align-items: center;
  gap: var(--p-2);
}

.superposition__tip-ico {
  color: var(--p-ink-3);
}

.superposition__tip-label {
  color: var(--p-ink-3);
}

.superposition__tip-value {
  color: var(--p-ink);
  font-weight: 600;
  text-align: right;
}

.superposition__footer {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
  min-height: 32px;
  padding-top: var(--p-5);
  overflow: visible;
}

.superposition__footer-spacer {
  flex: 1;
  min-width: 0;
}

.superposition__period {
  width: 120px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.superposition__period :deep(.q-field) {
  width: 100%;
  height: 32px;
  margin: 0;
  padding: 0;
}

.superposition__period :deep(.q-field__bottom) {
  display: none;
}

.superposition__period :deep(.q-field__control),
.superposition__period :deep(.q-field--dense .q-field__control) {
  height: 32px !important;
  min-height: 32px !important;
  max-height: 32px;
}

.superposition__period :deep(.q-field__marginal),
.superposition__period :deep(.q-field__native),
.superposition__period :deep(.q-field__prefix),
.superposition__period :deep(.q-field__suffix),
.superposition__period :deep(.q-field__input) {
  height: 32px;
  min-height: 32px;
  padding-top: 0;
  padding-bottom: 0;
  line-height: 32px;
}

.superposition__empty {
  padding: var(--p-2) 0;
}

.superposition__skel .skel {
  height: 280px;
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}
</style>
