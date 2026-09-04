<template>
  <q-form class="base-form" @submit.prevent="onSubmit">
    <BaseBanner v-if="error" variant="neg" role="alert">
      {{ error }}
    </BaseBanner>
    <div class="base-form__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="base-form__footer">
      <slot name="footer" :loading="loading" />
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { BaseBanner } from '../BaseBanner';
import type { BaseFormProps } from './BaseForm.types';

const props = withDefaults(defineProps<BaseFormProps>(), {
  loading: false,
});

const emit = defineEmits<{
  submit: [event: Event];
}>();

function onSubmit(e: Event): void {
  if (props.loading) return;
  emit('submit', e);
}
</script>

<style scoped>
.base-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.base-form__body {
  display: flex;
  flex-direction: column;
  /* Зазор задаём именно gap'ом контейнера, а НЕ отступами у детей.
     Содержимое формы приходит слотом из вызывающего компонента и принадлежит
     его области видимости — scoped-селекторы вида `.base-form__body > .q-field`
     до него не достают и молча не делают ничего. На этом потеряли три подхода:
     правка выглядела применённой, а на экране не менялось ничего. gap — свойство
     самого контейнера, областей видимости не касается и работает всегда.

     Зачем зазор вообще: reserve-hint-space резервирует строку под подсказку и
     ошибку, но текст занимает её целиком, и следующее поле начинается сразу под
     ним — «Минимум 8 символов» ложилось на рамку поля «Повторите пароль», а
     «Пароли не совпадают» упиралось в кнопку. Инвариант «поля не прыгают»
     сохраняется: место резервируется всегда, зазор постоянный. */
  gap: var(--p-3);
}
</style>
