<template lang="pug">
//- Схема стоит прямо на странице: из какого кошелька в какой и в какой момент
//- переходят средства. Шаг = момент, откуда → куда, одно пояснение.
.edu-flow
  .t-sm.t-muted {{ $t('edubridge.moneyFlow.intro') }}
  template(v-for="section in sections" :key="section.key")
    .t-eyebrow.edu-flow__section {{ section.title }}
    ol.edu-flow__steps
      li.edu-flow__step(v-for="(step, i) in section.steps" :key="step.key")
        .edu-flow__marker {{ i + 1 }}
        .edu-flow__body
          .edu-flow__when {{ step.when }}
          .edu-flow__route
            span.edu-flow__node(:class="{ 'edu-flow__node--outer': !step.from.icon }")
              q-icon(v-if="step.from.icon" :name="step.from.icon" size="16px")
              | {{ step.from.label }}
            q-icon.edu-flow__arrow(name="arrow_forward" size="18px")
            span.edu-flow__node(:class="{ 'edu-flow__node--outer': !step.to.icon }")
              q-icon(v-if="step.to.icon" :name="step.to.icon" size="16px")
              | {{ step.to.label }}
          .t-sm.t-muted {{ step.text }}
</template>

<script setup lang="ts">
import { PROGRAM_WALLET_ICONS } from '../../shared/lib/programWallets';
import { t } from '../../i18n';

/** Узел схемы: кошелёк программы со значком плитки либо внешняя сторона без значка. */
interface FlowNode {
  label: string;
  icon?: string;
}
interface FlowStep {
  key: string;
  when: string;
  from: FlowNode;
  to: FlowNode;
  text: string;
}

const member: FlowNode = { label: t('edubridge.moneyFlow.node.member'), icon: PROGRAM_WALLET_ICONS['w.edu.member'] };
const escrow: FlowNode = { label: t('edubridge.moneyFlow.node.escrow'), icon: PROGRAM_WALLET_ICONS['w.edu.escrow'] };
const fund: FlowNode = { label: t('edubridge.moneyFlow.node.fund'), icon: PROGRAM_WALLET_ICONS['w.edu.fund'] };
const reserve: FlowNode = { label: t('edubridge.moneyFlow.node.reserve'), icon: PROGRAM_WALLET_ICONS['w.edu.teach'] };
const studentShare: FlowNode = { label: t('edubridge.moneyFlow.node.studentShare') };
const teacherShare: FlowNode = { label: t('edubridge.moneyFlow.node.teacherShare') };
const expenseRecipient: FlowNode = { label: t('edubridge.moneyFlow.node.expenseRecipient') };

const step = (key: 'convert' | 'subscribe' | 'release' | 'allot' | 'settle' | 'refund' | 'expense', from: FlowNode, to: FlowNode): FlowStep => ({
  key,
  when: t(`edubridge.moneyFlow.step.${key}.when`),
  from,
  to,
  text: t(`edubridge.moneyFlow.step.${key}.text`),
});

const sections: { key: string; title: string; steps: FlowStep[] }[] = [
  {
    key: 'path',
    title: t('edubridge.moneyFlow.sectionPath'),
    steps: [
      step('convert', studentShare, member),
      step('subscribe', member, escrow),
      step('release', escrow, fund),
      step('allot', fund, reserve),
      step('settle', reserve, teacherShare),
    ],
  },
  {
    key: 'exits',
    title: t('edubridge.moneyFlow.sectionExits'),
    steps: [step('refund', escrow, member), step('expense', fund, expenseRecipient)],
  },
];
</script>

<style scoped>
.edu-flow__section {
  margin-top: var(--p-5);
  margin-bottom: var(--p-3);
}
.edu-flow__steps {
  list-style: none;
  margin: 0;
  padding: 0;
}
.edu-flow__step {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--p-3);
  padding-bottom: var(--p-4);
}
/* Линия пути соединяет номера шагов; у последнего шага её нет. */
.edu-flow__step:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 13px;
  top: 28px;
  bottom: 0;
  width: 1px;
  background: var(--p-line);
}
.edu-flow__marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-pill);
  background: var(--p-surface);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink-2);
}
.edu-flow__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
}
.edu-flow__when {
  font-weight: 600;
  line-height: 28px;
}
.edu-flow__route {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2);
}
.edu-flow__node {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  padding: var(--p-1) var(--p-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink);
}
/* Сторона за пределами кошельков программы — пунктиром, без значка. */
.edu-flow__node--outer {
  border-style: dashed;
  background: transparent;
  color: var(--p-ink-2);
}
.edu-flow__arrow {
  flex: none;
  color: var(--p-ink-3);
}
</style>
