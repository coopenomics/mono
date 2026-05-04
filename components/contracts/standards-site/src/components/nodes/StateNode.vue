<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';

const props = defineProps<{
  data: {
    label: string;
    human?: string;
    description?: string;
    entity?: string;
    isFocus: boolean;
  };
}>();

const humanLabel = computed(() => props.data.human ?? '');
const entityLabel = computed(() => props.data.entity ?? '');
</script>

<template>
  <div class="node-state" :class="{ 'node-state--focus': data.isFocus }">
    <div v-if="entityLabel" class="node-state__entity">{{ entityLabel }}</div>
    <div v-if="humanLabel" class="node-state__human">{{ humanLabel }}</div>
    <div class="node-state__label">{{ data.label }}</div>
    <Handle type="target" :position="Position.Left" :connectable="false" />
    <Handle type="source" :position="Position.Right" :connectable="false" />
  </div>
</template>

<style scoped>
.node-state {
  position: relative;
  width: 220px;
  height: 96px;
  padding: 8px 14px;
  border-radius: 3px;
  background: var(--bg);
  border: 1.5px solid var(--border-strong);
  display: flex;
  flex-direction: column;
  gap: 1px;
  cursor: pointer;
  transition: border-color 100ms ease, box-shadow 100ms ease, background 100ms ease;
  overflow: hidden;
}
/* Явный hint кликабельности: маленький «+» в правом верхнем углу */
.node-state::after {
  content: '';
  position: absolute;
  top: 6px;
  right: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-subtle);
  opacity: 0.5;
  transition: background 100ms ease, opacity 100ms ease;
}
.node-state:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.node-state:hover::after {
  background: var(--accent);
  opacity: 1;
}
.node-state--focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.node-state--focus::after {
  background: var(--accent);
  opacity: 1;
}
.node-state__entity {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.1;
  margin-bottom: 2px;
}
.node-state__human {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.node-state__label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 400;
  color: var(--text-muted);
  line-height: 1.1;
  margin-top: 2px;
  opacity: 0.75;
}
:deep(.vue-flow__handle) {
  opacity: 0;
  pointer-events: none;
}
</style>
