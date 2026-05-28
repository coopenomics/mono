<template>
  <div class="auth-layout">
    <div class="auth-layout__theme">
      <ThemeToggle />
    </div>
    <div class="auth-layout__inner">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ThemeToggle } from 'src/shared/ui/base/ThemeToggle';
</script>

<style scoped>
.auth-layout {
  position: relative;
  background: var(--p-canvas);
  color: var(--p-ink);
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
}
.auth-layout__theme {
  position: absolute;
  top: var(--p-4, 16px);
  right: var(--p-4, 16px);
}
.auth-layout__inner {
  width: 100%;
  max-width: 480px;
}
</style>
