<script setup lang="ts">
import { BaseButton, BaseCard, BaseForm } from 'src/shared/ui/base'

/**
 * Единая рамка шага мастера подключения: заголовок, человеческое пояснение,
 * тело и липкий нижний бар с «Назад / Дальше». Шаги отличаются только
 * содержимым — рамка у всех одна, чтобы мастер читался как одно целое.
 */
withDefaults(
  defineProps<{
    title: string
    /** Что это за шаг и зачем он нужен — простым языком. */
    lead: string
    /** Можно ли вернуться на предыдущий шаг. */
    canBack?: boolean
    /** Показывать ли главную кнопку — у шагов ожидания её нет. */
    hasNext?: boolean
    nextLabel?: string
    nextDisabled?: boolean
    loading?: boolean
  }>(),
  { canBack: true, hasNext: true, nextLabel: 'Дальше', nextDisabled: false, loading: false },
)

const emit = defineEmits<{ back: []; next: [] }>()
</script>

<template lang="pug">
BaseForm.step-frame(:loading="loading" @submit="emit('next')")
  BaseCard(:title="title" :subtitle="lead")
    slot

  template(#footer)
    .step-frame__bar
      BaseButton(
        v-if="canBack"
        variant="ghost"
        size="md"
        type="button"
        :disabled="loading"
        @click="emit('back')"
      )
        q-icon(name="arrow_back" size="16px").q-mr-xs
        | Назад
      q-space
      BaseButton(
        v-if="hasNext"
        variant="primary"
        size="md"
        type="submit"
        :loading="loading"
        :disabled="nextDisabled"
      ) {{ nextLabel }}
</template>

<style scoped>
/* Бар с навигацией прибит к низу экрана — пользователь всегда видит, как
   продолжить, даже если содержимое шага длинное (соглашение). */
.step-frame__bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: var(--p-2);
  padding: var(--p-3) 0;
  background: var(--p-canvas);
  border-top: 1px solid var(--p-line);
}
</style>
