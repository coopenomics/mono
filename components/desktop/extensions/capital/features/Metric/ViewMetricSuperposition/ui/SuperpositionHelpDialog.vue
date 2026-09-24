<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  :title='$t("capital.superpositionHelpDialog.title")',
  size='lg',
  @update:model-value='emit("update:modelValue", $event)'
)
  .sp-help
    .sp-help__intro
      p.sp-help__lead
        | {{ $t('capital.superpositionHelpDialog.summaryIntro') }}
        |  {{ $t('capital.superpositionHelpDialog.resonanceIntroPre') }}
        strong  {{ $t('capital.superpositionHelpDialog.resonanceWord') }}
        | {{ $t('capital.superpositionHelpDialog.resonanceIntroPost') }}
        |  {{ $t('capital.superpositionHelpDialog.intensityWeakens') }}
      p.sp-help__p
        | {{ $t('capital.superpositionHelpDialog.alignedGrowth') }}
        |  {{ $t('capital.superpositionHelpDialog.mixedRhythmsLoss') }}
        |  {{ $t('capital.superpositionHelpDialog.visibleOnTarget') }}

    .sp-help__step
      .sp-help__step-num 1
      .sp-help__step-body
        .sp-help__h {{ $t('capital.superpositionHelpDialog.sourceHeading') }}
        p.sp-help__p
          | {{ $t('capital.superpositionHelpDialog.metricOwnPath') }}
          |  {{ $t('capital.superpositionHelpDialog.metricTypeIrrelevant') }}
          |  {{ $t('capital.superpositionHelpDialog.compareNotUnitsPre') }}
          strong  {{ $t('capital.superpositionHelpDialog.movementCharacterWord') }}
          | {{ $t('capital.superpositionHelpDialog.compareNotUnitsPost') }}
        svg.sp-help__chart(
          viewBox='0 0 320 88',
          role='img',
          :aria-label='$t("capital.superpositionHelpDialog.wavesAriaLabel")'
        )
          line.sp-help__axis(x1='8', y1='44', x2='312', y2='44')
          path.sp-help__wave.sp-help__wave--pos(
            d='M8 44 C40 12, 72 12, 104 44 S168 76, 200 44 S264 12, 312 44'
            fill='none'
          )
          path.sp-help__wave.sp-help__wave--neg(
            d='M8 44 C40 68, 72 68, 104 44 S168 20, 200 44 S264 68, 312 44'
            fill='none'
          )
        .sp-help__legend
          span.sp-help__dot.sp-help__dot--pos
          span {{ $t('capital.superpositionHelpDialog.toTargetLabel') }}
          span.sp-help__dot.sp-help__dot--neg
          span {{ $t('capital.superpositionHelpDialog.fromTargetLabel') }}

    .sp-help__step
      .sp-help__step-num 2
      .sp-help__step-body
        .sp-help__h {{ $t('capital.superpositionHelpDialog.rhythmHeading') }}
        p.sp-help__p
          | {{ $t('capital.superpositionHelpDialog.alignedResultPre') }}
          |  {{ $t('capital.superpositionHelpDialog.alignedResultMid') }}
          |  {{ $t('capital.superpositionHelpDialog.effortWasted') }}
        p.sp-help__p
          | {{ $t('capital.superpositionHelpDialog.notOnlyGrowthPre') }}
          strong  {{ $t('capital.superpositionHelpDialog.howAlignedGrowthWord') }}
          | {{ $t('capital.superpositionHelpDialog.alignedMovementGives') }}
        svg.sp-help__chart(
          viewBox='0 0 320 88',
          role='img',
          :aria-label='$t("capital.superpositionHelpDialog.alignedSumAriaLabel")'
        )
          line.sp-help__axis(x1='8', y1='44', x2='312', y2='44')
          path.sp-help__wave.sp-help__wave--ghost(
            d='M8 44 C40 18, 72 18, 104 44 S168 70, 200 44 S264 18, 312 44'
            fill='none'
          )
          path.sp-help__wave.sp-help__wave--ghost(
            d='M8 44 C40 22, 72 22, 104 44 S168 66, 200 44 S264 22, 312 44'
            fill='none'
          )
          path.sp-help__wave.sp-help__wave--sum(
            d='M8 44 C40 4, 72 4, 104 44 S168 84, 200 44 S264 4, 312 44'
            fill='none'
          )
        .sp-help__legend
          span.sp-help__dot.sp-help__dot--ghost
          span {{ $t('capital.superpositionHelpDialog.movementsSeparately') }}
          span.sp-help__dot.sp-help__dot--sum
          span {{ $t('capital.superpositionHelpDialog.combinedEffectAligned') }}

    .sp-help__step
      .sp-help__step-num 3
      .sp-help__step-body
        .sp-help__h {{ $t('capital.superpositionHelpDialog.readTargetHeading') }}
        p.sp-help__p
          | {{ $t('capital.superpositionHelpDialog.circleSectorsIntro') }}
          strong  {{ $t('capital.superpositionHelpDialog.unequalWord') }}
          | {{ $t('capital.superpositionHelpDialog.pressureImbalance') }}
        ul.sp-help__list
          li
            strong {{ $t('capital.superpositionHelpDialog.sectorWidthLabel') }}
            |  {{ $t('capital.superpositionHelpDialog.sectorWidthExplain') }}
          li
            strong {{ $t('capital.superpositionHelpDialog.centerLengthLabel') }}
            |  {{ $t('capital.superpositionHelpDialog.centerLengthExplain') }}
          li
            strong {{ $t('capital.superpositionHelpDialog.greenWord') }}
            |  {{ $t('capital.superpositionHelpDialog.greenExplain') }}
            strong  {{ $t('capital.superpositionHelpDialog.redWord') }}
            |  {{ $t('capital.superpositionHelpDialog.redExplain') }}
          li
            strong {{ $t('capital.superpositionHelpDialog.centerWord') }}
            |  {{ $t('capital.superpositionHelpDialog.centerExplain') }}
        SuperpositionTargetChart.sp-help__target-chart(
          :sectors='helpSectors',
          :size='200',
          :cx='100',
          :cy='100',
          :max-r='90',
          :core-r='14',
          :core-fill='helpCoreFill',
          grad-prefix='help-',
          :aria-label='$t("capital.superpositionHelpDialog.exampleAriaLabel")'
        )
        .sp-help__legend
          span.sp-help__dot.sp-help__dot--pos
          span {{ $t('capital.superpositionHelpDialog.toTargetVaryingStrength') }}
          span.sp-help__dot.sp-help__dot--neg
          span {{ $t('capital.superpositionHelpDialog.rollbackWord') }}

    .sp-help__step
      .sp-help__step-num 4
      .sp-help__step-body
        .sp-help__h {{ $t('capital.superpositionHelpDialog.numbersAboveHeading') }}
        p.sp-help__p
          | {{ $t('capital.superpositionHelpDialog.fourIndicatorsPre') }}
          strong  {{ $t('capital.superpositionHelpDialog.resonanceWord') }}
          | {{ $t('capital.superpositionHelpDialog.percentFrom0to100') }}
        ul.sp-help__list
          li
            strong {{ $t('capital.superpositionHelpDialog.movementWord') }}
            |  {{ $t('capital.superpositionHelpDialog.movementExplain') }}
          li
            strong {{ $t('capital.superpositionHelpDialog.growthWord') }}
            |  {{ $t('capital.superpositionHelpDialog.growthExplainPre') }}
            |  {{ $t('capital.superpositionHelpDialog.growthExplainPost') }}
          li
            strong {{ $t('capital.superpositionHelpDialog.balanceWord') }}
            |  {{ $t('capital.superpositionHelpDialog.balanceExplainPre') }}
            |  {{ $t('capital.superpositionHelpDialog.balanceExplainPost') }}
          li
            strong {{ $t('capital.superpositionHelpDialog.resonanceWordStandalone') }}
            |  {{ $t('capital.superpositionHelpDialog.resonanceExplain') }}

    .sp-help__step
      .sp-help__step-num 5
      .sp-help__step-body
        .sp-help__h {{ $t('capital.superpositionHelpDialog.strivingHeading') }}
        p.sp-help__p
          | {{ $t('capital.superpositionHelpDialog.threeConditionsIntro') }}
        ul.sp-help__list
          li
            strong {{ $t('capital.superpositionHelpDialog.growthNotBelowZero') }}
            |  {{ $t('capital.superpositionHelpDialog.growthNotBelowZeroExplain') }}
          li
            strong {{ $t('capital.superpositionHelpDialog.movementAboveZero') }}
            |  {{ $t('capital.superpositionHelpDialog.movementAboveZeroExplain') }}
          li
            strong {{ $t('capital.superpositionHelpDialog.balanceTowards100') }}
            |  {{ $t('capital.superpositionHelpDialog.balanceTowards100Explain') }}
        p.sp-help__p
          | {{ $t('capital.superpositionHelpDialog.togetherHighPercentPre') }}
          strong  {{ $t('capital.superpositionHelpDialog.resonanceWordGenitive') }}
          | {{ $t('capital.superpositionHelpDialog.togetherHighPercentPost') }}

  template(#footer)
    BaseButton(
      variant='primary',
      type='button',
      @click='emit("update:modelValue", false)'
    ) {{ $t('capital.superpositionHelpDialog.acknowledgeAction') }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { buildPolarSectors, softHeatColor } from '../lib/superpositionPolar';
import SuperpositionTargetChart from './SuperpositionTargetChart.vue';
import { t } from '../../../../i18n';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const $q = useQuasar();

const helpCoreFill = computed(() =>
  softHeatColor(0.45, $q.dark.isActive),
);

/** Пример как на живой мишени: разная ширина (баланс) и длина (движение), зелёный/красный (рост). */
const helpSectors = computed(() => {
  void $q.dark.isActive;
  return buildPolarSectors(
    [
      {
        metric_hash: 'help-strong',
        title: t('capital.superpositionHelpDialog.strongToTargetTag'),
        amplitude: 1,
        phase_rad: 0,
      },
      {
        metric_hash: 'help-weak',
        title: t('capital.superpositionHelpDialog.weakToTargetTag'),
        amplitude: 0.28,
        phase_rad: 0,
      },
      {
        metric_hash: 'help-corr',
        title: t('capital.superpositionHelpDialog.rollbackWord'),
        amplitude: 0.62,
        phase_rad: Math.PI,
      },
    ],
    {
      cx: 100,
      cy: 100,
      maxR: 90,
      innerR: 0,
      growth: 0.4,
      activity: 0.9,
      dark: $q.dark.isActive,
    },
  );
});
</script>

<style lang="scss" scoped>
.sp-help {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
  line-height: 1.45;
}

.sp-help__intro {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.sp-help__lead {
  margin: 0;
  color: var(--p-ink);
}

.sp-help__step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--p-3);
  align-items: start;
}

.sp-help__step-num {
  width: 28px;
  height: 28px;
  border-radius: var(--p-r-pill, 999px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--p-fs-caption);
  color: var(--p-ink);
  background: var(--p-surface-3, var(--p-surface-2));
  border: 1px solid var(--p-line);
}

.sp-help__step-body {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
}

.sp-help__h {
  font-weight: 600;
  color: var(--p-ink);
}

.sp-help__p {
  margin: 0;
}

.sp-help__list {
  margin: 0;
  padding-left: var(--p-4);
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.sp-help__list strong {
  color: var(--p-ink);
}

.sp-help__chart,
.sp-help__target {
  width: 100%;
  max-width: 420px;
  height: auto;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
}

.sp-help__target-chart {
  max-width: 240px;
  align-self: start;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  padding: var(--p-2);
  box-sizing: border-box;
}

.sp-help__axis {
  stroke: var(--p-line);
  stroke-width: 1;
}

.sp-help__wave {
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sp-help__wave--pos {
  stroke: var(--p-pos);
}

.sp-help__wave--neg {
  stroke: var(--p-neg);
}

.sp-help__wave--ghost {
  stroke: var(--p-ink-3);
  stroke-width: 1.5;
  opacity: 0.7;
}

.sp-help__wave--sum {
  stroke: var(--p-primary);
  stroke-width: 3;
}

.sp-help__legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2) var(--p-3);
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
}

.sp-help__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sp-help__dot--pos {
  background: var(--p-pos);
}

.sp-help__dot--neg {
  background: var(--p-neg);
}

.sp-help__dot--ghost {
  background: var(--p-ink-3);
}

.sp-help__dot--sum {
  background: var(--p-primary);
}
</style>
