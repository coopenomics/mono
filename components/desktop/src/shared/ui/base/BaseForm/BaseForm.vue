<template>
  <q-form class="base-form" @submit.prevent="onSubmit">
    <q-banner
      v-if="error"
      class="base-form__banner bg-negative-soft"
      role="alert"
      dense
    >
      {{ error }}
    </q-banner>
    <div class="base-form__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="base-form__footer">
      <slot name="footer" :loading="loading" />
    </div>
  </q-form>
</template>

<script setup lang="ts">
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
  /* gap не задаём — reserve-hint-space у q-input уже даёт ~24px
     снизу под error/hint, дополнительный gap делает расстояние
     избыточным и неприятным. */
}

/* Не-поля (баннер, пояснение, разделитель) своего запаса снизу не имеют, а
   форма на него и рассчитывает — поэтому они прилипали к следующему полю
   вплотную. Даём им тот же ритм, что даёт полю зарезервированная строка
   подсказки. Полей правило не касается: у них запас уже есть. */
.base-form__body > *:not(.q-field):not(:last-child) {
  margin-block-end: var(--p-4);
}

/* Когда у поля есть подсказка или ошибка, текст занимает весь
   зарезервированный запас, и следующее поле начинается сразу под ним —
   строка «Минимум 8 символов» читалась как подпись к полю ниже. Небольшой
   зазор разводит их, не раздувая форму: между полями без подсказок разница
   почти незаметна, а инвариант «поля не прыгают» сохраняется, потому что
   место под подсказку резервируется всегда. */
.base-form__body > .q-field:not(:last-child) {
  margin-block-end: var(--p-1);
}
.base-form__banner {
  background: var(--p-neg-soft);
  color: var(--p-neg);
  border-left: 3px solid var(--p-neg);
  border-radius: var(--p-r-sm, 8px);
}
</style>
