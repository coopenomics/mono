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
        svg.edu-flow__svg(viewBox="0 0 560 616" role="img" :aria-label="$t('edubridge.moneyFlow.title')")
          defs
            marker#edu-flow-arrow(viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse")
              path.edu-flow__head(d="M0 0 L10 5 L0 10 z")
          path.edu-flow__line(v-for="a in ARROWS" :key="`l${a.n}`" :d="a.d" marker-end="url(#edu-flow-arrow)")
          g(v-for="b in BOXES" :key="b.key" :class="`edu-flow__box edu-flow__box--${b.tone}`")
            rect(:x="b.x" :y="b.y" :width="b.w" height="62" rx="12")
            text.edu-flow__name(:x="b.x + b.w / 2" :y="b.note ? b.y + 27 : b.y + 36" text-anchor="middle") {{ b.label }}
            text.edu-flow__note(v-if="b.note" :x="b.x + b.w / 2" :y="b.y + 47" text-anchor="middle") {{ b.note }}
          g.edu-flow__badge(v-for="a in ARROWS" :key="`n${a.n}`")
            circle(:cx="a.cx" :cy="a.cy" r="12")
            text(:x="a.cx" :y="a.cy + 4.5" text-anchor="middle") {{ a.n }}
      //- Шаги: номер совпадает с номером стрелки на схеме.
      .edu-flow__text
        .t-sm.t-muted.q-mb-md {{ $t('edubridge.moneyFlow.intro') }}
        ol.edu-flow__steps
          li.edu-flow__step(v-for="s in STEPS" :key="s.n")
            .edu-flow__num {{ s.n }}
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
  { key: 'studentShare', x: 130, y: 8, w: 300, tone: 'outer', label: t('edubridge.moneyFlow.node.studentShare') },
  { key: 'member', x: 130, y: 122, w: 300, tone: 'member', label: t('edubridge.moneyFlow.node.member') },
  { key: 'escrow', x: 130, y: 236, w: 300, tone: 'escrow', label: t('edubridge.moneyFlow.node.escrow'), note: t('edubridge.moneyFlow.scheme.escrowNote') },
  { key: 'reserve', x: 6, y: 390, w: 250, tone: 'reserve', label: t('edubridge.moneyFlow.node.reserve'), note: t('edubridge.moneyFlow.scheme.reserveShare') },
  { key: 'fund', x: 304, y: 390, w: 250, tone: 'fund', label: t('edubridge.moneyFlow.node.fund'), note: t('edubridge.moneyFlow.scheme.fundShare') },
  { key: 'teacherShare', x: 6, y: 546, w: 250, tone: 'outer', label: t('edubridge.moneyFlow.scheme.teacherShare'), note: t('edubridge.moneyFlow.scheme.teacherShareNote') },
  { key: 'expenseRecipient', x: 304, y: 546, w: 250, tone: 'outer', label: t('edubridge.moneyFlow.node.expenseRecipient') },
];

/** Переход на схеме: линия и место номера. */
interface Arrow {
  n: number;
  d: string;
  cx: number;
  cy: number;
}

const ARROWS: Arrow[] = [
  { n: 1, d: 'M280 70 L280 119', cx: 280, cy: 93 },
  { n: 2, d: 'M280 184 L280 233', cx: 280, cy: 207 },
  { n: 3, d: 'M230 298 C230 350 100 335 100 387', cx: 163, cy: 343 },
  { n: 4, d: 'M330 298 C330 350 460 335 460 387', cx: 397, cy: 343 },
  // Возврат из резерва на кошелёк программы идёт дугой под кошельками: между ними номеру тесно.
  { n: 5, d: 'M200 452 C200 512 360 512 360 455', cx: 280, cy: 497 },
  { n: 6, d: 'M80 452 L80 543', cx: 80, cy: 497 },
  { n: 7, d: 'M480 452 L480 543', cx: 480, cy: 497 },
  { n: 8, d: 'M430 267 C512 267 512 153 433 153', cx: 491, cy: 210 },
];

const STEP_KEYS = ['convert', 'subscribe', 'allot', 'release', 'lesson', 'settle', 'expense', 'refund'] as const;
const STEPS = STEP_KEYS.map((key, i) => ({
  n: ARROWS[i].n,
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
  font-size: 15px;
  font-weight: 600;
}
.edu-flow__box--outer .edu-flow__name {
  fill: var(--p-ink-2);
  font-weight: 500;
}
.edu-flow__note {
  fill: var(--p-ink-2);
  font-size: 12px;
}
.edu-flow__line {
  fill: none;
  stroke: var(--p-ink-3);
  stroke-width: 1.5;
  stroke-linecap: round;
}
.edu-flow__head {
  fill: var(--p-ink-2);
  stroke: none;
}
/* Номера переходов одного вида: цвет на схеме несут только кошельки. */
.edu-flow__badge circle {
  fill: var(--p-surface);
  stroke: var(--p-ink-3);
  stroke-width: 1.5;
}
.edu-flow__badge text {
  fill: var(--p-ink);
  font-size: 13px;
  font-weight: 700;
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
  border: 1.5px solid var(--p-ink-3);
  background: var(--p-surface);
  color: var(--p-ink);
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
