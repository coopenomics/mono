<template>
  <!--
    Пояснение к полю — маленький «?» рядом с ним, текст всплывает при наведении.
    Строка под полем остаётся для ошибки ввода. Щелчок по значку не доходит до
    поля: выпадающий список не раскрывается, фокус не переходит.
  -->
  <q-icon
    name="help_outline"
    class="field-help"
    role="img"
    :aria-label="text"
    @click.stop
    @mousedown.stop
  >
    <q-tooltip max-width="320px" anchor="top middle" self="bottom middle" :offset="[0, 6]">
      {{ text }}
    </q-tooltip>
  </q-icon>
</template>

<script setup lang="ts">
import type { FieldHelpProps } from './FieldHelp.types';

defineProps<FieldHelpProps>();
</script>

<style scoped>
.field-help {
  font-size: var(--p-fs-body);
  color: var(--p-ink-3);
  cursor: help;
}
.field-help:hover {
  color: var(--p-ink-2);
}
</style>
