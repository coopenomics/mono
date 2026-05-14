<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';

defineProps<{
  data: {
    label: string;
    title?: string;
    summary?: string;
    purpose?: string;
    isFocus: boolean;
  };
}>();
</script>

<template>
  <div class="start-wrap">
    <div class="node-start" :class="{ 'node-start--focus': data.isFocus }" :title="data.summary">
      <span class="node-start__glyph">{{ data.label }}</span>
      <Handle type="target" :position="Position.Left" :connectable="false" />
      <Handle type="source" :position="Position.Right" :connectable="false" />
    </div>
    <div class="start-wrap__caption">начало процесса</div>
  </div>
</template>

<style scoped>
.start-wrap {
  width: 128px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.node-start {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color 100ms ease, background 100ms ease, box-shadow 100ms ease,
    color 100ms ease;
}
.node-start:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.node-start--focus {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.node-start__glyph {
  font-size: 20px;
  line-height: 1;
}
.start-wrap__caption {
  font-size: 10px;
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
  pointer-events: none;
}
:deep(.vue-flow__handle) {
  opacity: 0;
  pointer-events: none;
}
</style>
