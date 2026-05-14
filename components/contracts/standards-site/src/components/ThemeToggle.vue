<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next';
import { useTheme } from '@/composables/useTheme';

const { theme, toggle } = useTheme();
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :title="theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'"
    :aria-label="theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'"
    @click="toggle"
  >
    <Sun v-if="theme === 'dark'" :size="16" />
    <Moon v-else :size="16" />
    <span>{{ theme === 'dark' ? 'Светлая' : 'Тёмная' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 12px;
  transition: background 80ms ease, color 80ms ease, border-color 80ms ease;
}
.theme-toggle:hover {
  background: var(--surface-hover);
  color: var(--text);
  border-color: var(--border-strong);
}
</style>
