<template lang="pug">
//- Сведения сеткой «подпись над значением»: строго, без разлиновки строк.
//- Колонок столько, сколько помещается по ширине места; длинное значение
//- (назначение, причина) занимает всю строку сетки.
dl.process-facts
  .process-facts__item(
    v-for='fact in items'
    :key='fact.label'
    :class='{ "process-facts__item--wide": fact.wide }'
  )
    dt.process-facts__label {{ fact.label }}
    dd.process-facts__value(:class='{ "process-facts__value--mono": fact.mono }') {{ fact.value }}
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ProcessFact {
  label: string
  value: string
  /** Код, номер, хэш — моноширинным шрифтом. */
  mono?: boolean
  /** Всю строку сетки; по умолчанию — по длине значения. */
  wide?: boolean
}

const props = defineProps<{ facts: ProcessFact[] }>()

/** Значение длиннее предела в колонку сетки не помещается — строка на всю ширину. */
const WIDE_VALUE_LIMIT = 40

const items = computed(() =>
  props.facts
    .filter((fact) => fact.value)
    .map((fact) => ({ ...fact, wide: fact.wide ?? fact.value.length > WIDE_VALUE_LIMIT })),
)
</script>

<style scoped>
.process-facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--p-4) var(--p-6);
  margin: 0;
}
.process-facts__item {
  min-width: 0;
}
.process-facts__item--wide {
  grid-column: 1 / -1;
}
.process-facts__label {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  margin-bottom: var(--p-1);
}
.process-facts__value {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink);
  overflow-wrap: anywhere;
}
.process-facts__value--mono {
  font-family: var(--p-mono);
}
</style>
