<!-- BackButton.vue -->
<template lang="pug">
q-btn.back-button(
  v-if='backNavigationButton',
  :stretch='isMobile',
  push,
  color='primary',
  @click='backNavigationButton.onClick'
)
  i.fa-solid.fa-chevron-left
  span.q-pl-sm(v-if='!isMobile') {{ backNavigationButton.text }}
</template>

<script setup lang="ts">
import { useDesktopStore } from 'src/entities/Desktop/model';
import { computed } from 'vue';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();
const desktopStore = useDesktopStore();
const backNavigationButton = computed(() => desktopStore.backNavigationButton);
</script>

<style scoped lang="scss">
.back-button {
  min-width: auto;
}
</style>
