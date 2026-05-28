<template lang="pug">
//- Вариант для хедера (кнопка). Compact icon-кнопка с тултипом.
q-btn(
  v-if='asButton',
  flat,
  stretch,
  :icon='isDark ? "brightness_7" : "brightness_3"',
  :size='isMobile ? "sm" : "md"',
  :aria-label='isDark ? "Светлая тема" : "Тёмная тема"',
  @click='toggleTheme'
)
  q-tooltip {{ isDark ? 'Светлая тема' : 'Тёмная тема' }}

//- Вариант для списка (элемент q-list внутри dropdown).
q-item(v-else, flat, clickable, @click='toggleTheme')
  q-item-section
    q-item-label
      q-icon.q-mr-sm(:name='isDark ? "brightness_7" : "brightness_3"')
      span.theme-toggle__label(v-if='showText') {{ isDark ? 'ДНЕВНОЙ РЕЖИМ' : 'НОЧНОЙ РЕЖИМ' }}
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed } from 'vue';
import { saveThemeToStorage, updatePWAThemeColor } from 'src/shared/lib/utils';

const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);

withDefaults(
  defineProps<{
    isMobile?: boolean;
    showText?: boolean;
    asButton?: boolean;
  }>(),
  {
    isMobile: false,
    showText: false,
    asButton: false,
  },
);

function toggleTheme(): void {
  $q.dark.toggle();
  saveThemeToStorage($q.dark.isActive);
  updatePWAThemeColor($q.dark.isActive);
}
</script>

<style scoped>
.theme-toggle__label {
  font-size: 10px;
}
</style>
