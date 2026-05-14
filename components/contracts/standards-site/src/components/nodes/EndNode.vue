<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';

defineProps<{
  data: {
    label: string;
    title?: string;
    summary?: string;
    purpose?: string;
    hasRelated?: boolean;
    isFocus: boolean;
  };
}>();
</script>

<template>
  <div class="end-wrap">
    <div class="node-end" :class="{ 'node-end--focus': data.isFocus }" :title="data.summary">
      <span class="node-end__glyph">{{ data.label }}</span>
      <Handle type="target" :position="Position.Left" :connectable="false" />
      <Handle type="source" :position="Position.Right" :connectable="false" />
    </div>
    <div class="end-wrap__caption">конец процесса</div>
  </div>
</template>

<style scoped>
.end-wrap {
  width: 128px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.node-end {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  cursor: pointer;
  transition: border-color 100ms ease, background 100ms ease, box-shadow 100ms ease,
    color 100ms ease;
}
.node-end::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  border: 1.5px solid var(--text);
}
.node-end:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.node-end:hover::before {
  border-color: var(--accent);
}
.node-end--focus {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.node-end--focus::before {
  border-color: var(--accent);
}
.node-end__glyph {
  position: relative;
  font-size: 14px;
  line-height: 1;
}
.end-wrap__caption {
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
