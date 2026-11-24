<template lang="pug">
//- Вопрос повестки: номер и заголовок, приложения (если есть), проект решения.
//- Слот под вопросом — для голоса: переключатель при голосовании, бейдж ответа после.
li.meet-question
  .meet-question__title
    span.meet-question__number {{ number }}.
    span {{ question.title }}
  .meet-question__context(v-if='question.context', v-html='parseLinks(question.context)')
  .meet-question__decision
    .meet-question__label {{ $t('meet.meetDetailsAgenda.decisionLabel') }}
    .meet-question__text {{ question.decision }}
  .meet-question__slot(v-if='$slots.default')
    slot
</template>

<script setup lang="ts">
import { parseLinks } from 'src/shared/lib/utils';

defineProps<{
  number: number;
  question: { title?: string | null; context?: string | null; decision?: string | null };
}>();
</script>

<style lang="scss" scoped>
// Вопросы разделены волосяной линией, без карточки в карточке.
.meet-question {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  padding: var(--p-4, 16px) 0;

  & + & {
    border-top: 1px solid var(--p-line);
  }

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }
}

.meet-question__title {
  display: flex;
  gap: var(--p-2, 8px);
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  line-height: var(--p-lh-h3, 1.3);
  color: var(--p-ink);
}

.meet-question__number {
  color: var(--p-ink-3);
  font-variant-numeric: tabular-nums;
}

.meet-question__context {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.5;
  color: var(--p-ink-2);
}

.meet-question__label {
  font-size: var(--p-fs-eyebrow, 11px);
  letter-spacing: var(--p-ls-eyebrow, 0.08em);
  text-transform: uppercase;
  color: var(--p-ink-3);
}

.meet-question__slot {
  margin-top: var(--p-2, 8px);
}

.meet-question__text {
  margin-top: 2px;
  font-size: var(--p-fs-body, 14px);
  line-height: 1.5;
  color: var(--p-ink);
}
</style>
