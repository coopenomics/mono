<template>
  <button
    type="button"
    class="btn btn--ghost btn--icon"
    :aria-label="isDark ? 'Светлая тема' : 'Тёмная тема'"
    @click="toggle"
  >
    {{ isDark ? '☀' : '☾' }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Dark } from 'quasar';

const isDark = computed(() => Dark.isActive);

function toggle(): void {
  Dark.set(!Dark.isActive);
}
</script>
