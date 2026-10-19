<script setup lang="ts">
import { BaseButton, BaseCard, BaseForm } from 'src/shared/ui/base'
import { t } from 'src/shared/i18n';

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
  { canBack: true, hasNext: true, nextLabel: t('connectionAgreementStepper.stepFrame.next'), nextDisabled: false, loading: false },
)

const emit = defineEmits<{ back: []; next: [] }>()
</script>

<template lang="pug">
BaseForm.step-frame(:loading="loading" @submit="emit('next')")
  BaseCard(:title="title" :subtitle="lead")
    //- Значок слева от заголовка — у шагов ожидания; без него шапка карточки обычная.
    template(v-if="$slots.icon" #head)
      .step-frame__head
        .step-frame__icon
          slot(name="icon")
        div
          .step-frame__title {{ title }}
          .step-frame__lead {{ lead }}
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
        | {{ $t('common.action.back') }}
      q-space
      //- Итог шага у главной кнопки: то, на что человек соглашается, нажимая «Дальше».
      slot(name="aside")
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
.step-frame__head {
  display: flex;
  align-items: center;
  gap: var(--p-4);
}
.step-frame__icon {
  flex: none;
}
/* Те же размеры, что у заголовка и подзаголовка BaseCard. */
.step-frame__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  letter-spacing: var(--p-ls-h3);
  color: var(--p-ink);
}
.step-frame__lead {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
  margin-top: 2px;
}
/* Бар с навигацией прибит к низу экрана — пользователь всегда видит, как
   продолжить, даже если содержимое шага длинное (соглашение). */
.step-frame__bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: var(--p-5);
  padding: var(--p-3) 0;
  background: var(--p-canvas);
  border-top: 1px solid var(--p-line);
}
</style>
