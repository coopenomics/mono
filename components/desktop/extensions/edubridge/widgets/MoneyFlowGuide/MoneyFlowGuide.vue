<template lang="pug">
//- Кнопка открывает справку: слева схема кошельков с пронумерованными
//- переходами, справа шаги с теми же номерами — что и когда происходит.
.edu-flow
  BaseButton(variant="ghost" size="sm" @click="open = true")
    template(#icon-left)
      q-icon(name="help_outline" size="18px")
    | {{ $t('edubridge.moneyFlow.button') }}

  BaseDialog(v-model="open" :title="$t('edubridge.moneyFlow.title')" size="xxl")
    .edu-flow__layout
      //- Схема: путь взноса сверху вниз, после гарантийного срока — развилка на два кошелька.
      .edu-flow__scheme
        svg.edu-flow__svg(viewBox="0 0 560 610" role="img" :aria-label="$t('edubridge.moneyFlow.title')")
          defs
            marker#edu-flow-arrow(viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse")
              path.edu-flow__head(d="M0 0 L10 5 L0 10 z")
          path.edu-flow__line(v-for="a in ARROWS" :key="`l${a.n}`" :d="a.d" marker-end="url(#edu-flow-arrow)")
          g(v-for="b in BOXES" :key="b.key" :class="`edu-flow__box edu-flow__box--${b.tone}`")
            rect(:x="b.x" :y="b.y" :width="b.w" height="58" rx="12")
            text.edu-flow__name(:x="b.x + b.w / 2" :y="b.note ? b.y + 25 : b.y + 34" text-anchor="middle") {{ b.label }}
            text.edu-flow__note(v-if="b.note" :x="b.x + b.w / 2" :y="b.y + 44" text-anchor="middle") {{ b.note }}
          g(v-for="a in ARROWS" :key="`n${a.n}`" :class="`edu-flow__badge edu-flow__badge--${a.tone}`")
            circle(:cx="a.cx" :cy="a.cy" r="13")
            text(:x="a.cx" :y="a.cy + 5" text-anchor="middle") {{ a.n }}
      //- Шаги: номер совпадает с номером стрелки на схеме.
      .edu-flow__text
        .t-sm.t-muted.q-mb-md {{ $t('edubridge.moneyFlow.intro') }}
        ol.edu-flow__steps
          li.edu-flow__step(v-for="s in STEPS" :key="s.n")
            .edu-flow__num(:class="`edu-flow__num--${s.tone}`") {{ s.n }}
            .edu-flow__body
              .edu-flow__when {{ s.when }}
              .t-sm.t-muted {{ s.text }}
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { t } from '../../i18n';

const open = ref(false);

/** Смысл кошелька задаёт его цвет на схеме: ученик, удержание, резерв, программа; `outer` — сторона за пределами программы. */
type Tone = 'member' | 'escrow' | 'reserve' | 'fund' | 'outer';

interface Box {
  key: string;
  x: number;
  y: number;
  w: number;
  tone: Tone;
  label: string;
  note?: string;
}

const BOXES: Box[] = [
  { key: 'studentShare', x: 170, y: 8, w: 220, tone: 'outer', label: t('edubridge.moneyFlow.node.studentShare') },
  { key: 'member', x: 170, y: 122, w: 220, tone: 'member', label: t('edubridge.moneyFlow.node.member') },
  { key: 'escrow', x: 170, y: 236, w: 220, tone: 'escrow', label: t('edubridge.moneyFlow.node.escrow'), note: t('edubridge.moneyFlow.scheme.escrowNote') },
  { key: 'reserve', x: 20, y: 390, w: 230, tone: 'reserve', label: t('edubridge.moneyFlow.node.reserve'), note: t('edubridge.moneyFlow.scheme.reserveShare') },
  { key: 'fund', x: 310, y: 390, w: 230, tone: 'fund', label: t('edubridge.moneyFlow.node.fund'), note: t('edubridge.moneyFlow.scheme.fundShare') },
  { key: 'teacherShare', x: 20, y: 540, w: 230, tone: 'outer', label: t('edubridge.moneyFlow.node.teacherShare') },
  { key: 'expenseRecipient', x: 310, y: 540, w: 230, tone: 'outer', label: t('edubridge.moneyFlow.node.expenseRecipient') },
];

/** Переход на схеме: линия, место номера и цвет кошелька, куда приходят средства. */
interface Arrow {
  n: number;
  d: string;
  cx: number;
  cy: number;
  tone: Tone;
}

const ARROWS: Arrow[] = [
  { n: 1, d: 'M280 66 L280 118', cx: 280, cy: 92, tone: 'member' },
  { n: 2, d: 'M280 180 L280 232', cx: 280, cy: 206, tone: 'escrow' },
  { n: 3, d: 'M240 294 C240 345 135 335 135 386', cx: 180, cy: 340, tone: 'reserve' },
  { n: 4, d: 'M320 294 C320 345 425 335 425 386', cx: 380, cy: 340, tone: 'fund' },
  { n: 5, d: 'M250 419 L306 419', cx: 280, cy: 419, tone: 'fund' },
  { n: 6, d: 'M135 448 L135 536', cx: 135, cy: 492, tone: 'reserve' },
  { n: 7, d: 'M425 448 L425 536', cx: 425, cy: 492, tone: 'fund' },
  { n: 8, d: 'M390 265 C470 265 470 151 394 151', cx: 449, cy: 208, tone: 'member' },
];

const STEP_KEYS = ['convert', 'subscribe', 'allot', 'release', 'lesson', 'settle', 'expense', 'refund'] as const;
const STEPS = STEP_KEYS.map((key, i) => ({
  n: ARROWS[i].n,
  tone: ARROWS[i].tone,
  when: t(`edubridge.moneyFlow.step.${key}.when`),
  text: t(`edubridge.moneyFlow.step.${key}.text`),
}));
</script>

<style scoped>
.edu-flow__layout {
  display: grid;
  grid-template-columns: minmax(0, 520px) minmax(0, 1fr);
  gap: var(--p-6);
  align-items: start;
}
@media (max-width: 960px) {
  .edu-flow__layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
.edu-flow__scheme {
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
  background: var(--p-surface-2);
}
.edu-flow__svg {
  display: block;
  width: 100%;
  height: auto;
}
/* Цвет несёт мягкая заливка кошелька; сторона вне программы — пунктиром, без заливки. */
.edu-flow__box rect {
  stroke-width: 1.5;
}
.edu-flow__box--member rect {
  fill: var(--p-info-soft);
  stroke: var(--p-info);
}
.edu-flow__box--escrow rect {
  fill: var(--p-warn-soft);
  stroke: var(--p-warn);
}
.edu-flow__box--reserve rect {
  fill: var(--p-primary-soft);
  stroke: var(--p-primary);
}
.edu-flow__box--fund rect {
  fill: var(--p-pos-soft);
  stroke: var(--p-pos);
}
.edu-flow__box--outer rect {
  fill: transparent;
  stroke: var(--p-ink-4);
  stroke-dasharray: 5 4;
}
.edu-flow__name {
  fill: var(--p-ink);
  font-size: 16px;
  font-weight: 600;
}
.edu-flow__box--outer .edu-flow__name {
  fill: var(--p-ink-2);
  font-weight: 500;
}
.edu-flow__note {
  fill: var(--p-ink-2);
  font-size: 12.5px;
}
.edu-flow__line {
  fill: none;
  stroke: var(--p-ink-3);
  stroke-width: 1.75;
}
.edu-flow__head {
  fill: var(--p-ink-3);
}
.edu-flow__badge circle {
  stroke: var(--p-surface-2);
  stroke-width: 3;
}
.edu-flow__badge text {
  fill: var(--p-ink-on-primary);
  font-size: 13px;
  font-weight: 700;
}
.edu-flow__badge--member circle {
  fill: var(--p-info);
}
.edu-flow__badge--escrow circle {
  fill: var(--p-warn);
}
.edu-flow__badge--reserve circle {
  fill: var(--p-primary);
}
.edu-flow__badge--fund circle {
  fill: var(--p-pos);
}
.edu-flow__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.edu-flow__step {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--p-3);
}
.edu-flow__num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--p-r-pill);
  font-size: var(--p-fs-body-sm);
  font-weight: 700;
  color: var(--p-ink-on-primary);
}
.edu-flow__num--member {
  background: var(--p-info);
}
.edu-flow__num--escrow {
  background: var(--p-warn);
}
.edu-flow__num--reserve {
  background: var(--p-primary);
}
.edu-flow__num--fund {
  background: var(--p-pos);
}
.edu-flow__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}
.edu-flow__when {
  font-weight: 600;
  line-height: 28px;
}
</style>
