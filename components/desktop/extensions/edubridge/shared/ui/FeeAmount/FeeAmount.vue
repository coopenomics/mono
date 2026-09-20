<template lang="pug">
span.edu-fee(:class="`edu-fee--${size}`")
  span.edu-fee__num {{ parts.num }}
  span.edu-fee__cur(v-if="parts.cur") {{ parts.cur }}
  span.edu-fee__per(v-if="per") {{ per }}
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

/**
 * Сумма взноса: число читается первым, валюта и период — приглушённой подписью.
 * Строка не переносится: «120 000,00 RUB» в узкой карточке иначе рвалось
 * на две строки и сумма теряла вес.
 */
const props = withDefaults(defineProps<{ value: string | null | undefined; size?: 'sm' | 'md' | 'lg'; per?: string }>(), {
  size: 'md',
  per: '',
});

const parts = computed(() => {
  const text = formatAsset2Digits(props.value);
  const i = text.lastIndexOf(' ');
  // Валюта — последнее слово из букв; «10 000,00» без валюты остаётся числом целиком.
  if (i < 0 || !/^[A-Za-zА-Яа-я₽]+$/.test(text.slice(i + 1))) return { num: text, cur: '' };
  return { num: text.slice(0, i), cur: text.slice(i + 1) };
});
</script>
<style scoped>
.edu-fee {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3em;
  white-space: nowrap;
  font-feature-settings: 'tnum' 1;
  color: var(--p-ink);
}
.edu-fee__num {
  font-weight: 600;
  letter-spacing: -0.015em;
}
.edu-fee__cur,
.edu-fee__per {
  color: var(--p-ink-3);
  font-weight: 400;
  font-size: 0.72em;
  letter-spacing: 0;
}
.edu-fee--sm {
  font-size: var(--p-fs-body, 14px);
}
.edu-fee--sm .edu-fee__cur,
.edu-fee--sm .edu-fee__per {
  font-size: var(--p-fs-meta, 12px);
}
.edu-fee--md {
  font-size: var(--p-fs-h2, 18px);
}
.edu-fee--lg {
  font-size: var(--p-fs-h1, 24px);
  line-height: 1.15;
}
.edu-fee--lg .edu-fee__cur,
.edu-fee--lg .edu-fee__per {
  font-size: var(--p-fs-body-sm, 13px);
}
</style>
