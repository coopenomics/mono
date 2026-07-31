<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  title='Метрика резонанса',
  size='lg',
  @update:model-value='emit("update:modelValue", $event)'
)
  .sp-help
    .sp-help__intro
      p.sp-help__lead
        | Это сводный показатель по всем метрикам компонента.
        |  Он показывает, входит ли движение к целям в
        strong  резонанс
        | : ритмы согласованы и усиливают общее продвижение — или расходятся,
        |  и общая интенсивность слабеет.
      p.sp-help__p
        | Когда движение согласовано, сила продвижения растёт.
        |  Когда ритмы разные — часть энергии не доходит до цели.
        |  На мишени это видно сразу по форме, цвету и трём числам сверху.

    .sp-help__step
      .sp-help__step-num 1
      .sp-help__step-body
        .sp-help__h Откуда берётся картина
        p.sp-help__p
          | У каждой метрики свой ход во времени: то ближе к цели, то дальше.
          |  Тип метрики не важен — деньги, сроки, охват или что угодно ещё.
          |  Мы сравниваем не единицы измерения, а
          strong  характер движения
          | : идёт ли метрика к цели или отступает.
        svg.sp-help__chart(
          viewBox='0 0 320 88',
          role='img',
          aria-label='Две волны движения'
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
          span К цели
          span.sp-help__dot.sp-help__dot--neg
          span От цели

    .sp-help__step
      .sp-help__step-num 2
      .sp-help__step-body
        .sp-help__h Почему важен общий ритм
        p.sp-help__p
          | Если несколько метрик движутся к целям согласованно, общий результат
          |  усиливается. Если одна идёт вперёд, а другая назад — общий эффект слабее:
          |  усилия тратятся, но точка продвижения почти не углубляется.
        p.sp-help__p
          | Поэтому на экране важны не только «есть ли рост», но и
          strong  насколько рост согласован
          | . Согласованное движение даёт большую интенсивность продвижения к целям.
        svg.sp-help__chart(
          viewBox='0 0 320 88',
          role='img',
          aria-label='Согласованное сложение движений'
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
          span Движения по отдельности
          span.sp-help__dot.sp-help__dot--sum
          span Общий эффект при согласии

    .sp-help__step
      .sp-help__step-num 3
      .sp-help__step-body
        .sp-help__h Как читать мишень
        p.sp-help__p
          | Круг — тот же общий эффект в удобном виде. Секторы
          strong  неравные
          | : так видно давление и перекос баланса.
        ul.sp-help__list
          li
            strong Ширина сектора
            |  — сила влияния. Шире — сильнее давит на общую картину.
          li
            strong Длина от центра
            |  — движение: насколько метрика сейчас активна. Короче — слабее пульс.
          li
            strong Зелёный
            |  — рост к цели.
            strong  Красный
            |  — рост от цели (откат).
          li
            strong Центр
            |  — сводка: резонанс и три составляющие. Наведите курсор.
        SuperpositionTargetChart.sp-help__target-chart(
          :sectors='helpSectors',
          :size='200',
          :cx='100',
          :cy='100',
          :max-r='90',
          :core-r='14',
          :core-fill='helpCoreFill',
          grad-prefix='help-',
          aria-label='Пример мишени с неравными секторами'
        )
        .sp-help__legend
          span.sp-help__dot.sp-help__dot--pos
          span К цели, разная сила
          span.sp-help__dot.sp-help__dot--neg
          span Откат

    .sp-help__step
      .sp-help__step-num 4
      .sp-help__step-body
        .sp-help__h Числа над мишенью
        p.sp-help__p
          | В одном ряду четыре показателя: баланс, рост, движение и выделенный
          strong  резонанс
          | — единый процент от 0 до 100.
        ul.sp-help__list
          li
            strong Движение
            |  — есть ли сейчас изменения. Ноль — тишина. Выше нуля — метрики менялись.
          li
            strong Рост
            |  — ведут ли эти изменения к целям. Ноль — к целям сейчас не продвигаемся.
            |  Выше — есть продвижение вперёд.
          li
            strong Баланс
            |  — согласованы ли направления метрик. Сто процентов — все в одной фазе
            |  (или тишина, когда никто не тянет). Ниже — часть идёт к цели, часть от неё, усилия гасятся.
          li
            strong Резонанс
            |  — сводный показатель из баланса, роста и движения.

    .sp-help__step
      .sp-help__step-num 5
      .sp-help__step-body
        .sp-help__h К чему стремиться
        p.sp-help__p
          | Чтобы система входила в резонанс и держала его, ориентируйтесь на три условия:
        ul.sp-help__list
          li
            strong Рост не ниже нуля
            |  — есть продвижение к целям, а не откат.
          li
            strong Движение выше нуля
            |  — процесс живой, метрики меняются, а не стоят на месте.
          li
            strong Баланс стремится к 100%
            |  — направления согласованы, метрики не гасят друг друга.
        p.sp-help__p
          | Вместе это даёт высокий процент
          strong  резонанса
          | : живое согласованное движение вперёд и максимальная интенсивность продвижения к целям.

  template(#footer)
    BaseButton(
      variant='primary',
      type='button',
      @click='emit("update:modelValue", false)'
    ) Понятно
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { buildPolarSectors, softHeatColor } from '../lib/superpositionPolar';
import SuperpositionTargetChart from './SuperpositionTargetChart.vue';

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
        title: 'Сильная к цели',
        amplitude: 1,
        phase_rad: 0,
      },
      {
        metric_hash: 'help-weak',
        title: 'Слабая к цели',
        amplitude: 0.28,
        phase_rad: 0,
      },
      {
        metric_hash: 'help-corr',
        title: 'Откат',
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
