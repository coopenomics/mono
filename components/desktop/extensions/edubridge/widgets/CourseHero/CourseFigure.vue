<template lang="pug">
//- Плитка числа курса: подпись сверху, значение под ней. Все плитки одного
//- размера и одного шрифта — ряд читается слева направо как одна строка фактов
//- (замечание владельца 25.11.2026: строки «подпись — значение» в три колонки
//- стояли неровно, значение срока было моноширинным).
.edu-figure
  .edu-figure__label {{ label }}
  .edu-figure__value
    slot {{ value }}
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  /** Значение текстом; сумма взноса передаётся слотом (FeeAmount). */
  value?: string | number;
}>();
</script>

<style scoped>
.edu-figure {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}
.edu-figure__label {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-3);
}
/* Подписи в словаре — строчными (их же читают карточки каталога под числом);
   в плитке подпись стоит отдельно и начинается с заглавной. */
.edu-figure__label::first-letter {
  text-transform: uppercase;
}
.edu-figure__value {
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'tnum' 1;
  white-space: nowrap;
}
</style>
