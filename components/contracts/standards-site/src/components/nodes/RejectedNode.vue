<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';

defineProps<{
  data: {
    label: string;
    actionShort?: string;
    actionName?: string;
    virtualState?: string;
    isFocus: boolean;
  };
}>();
</script>

<template>
  <div class="rejected-wrap">
    <div
      class="node-rejected"
      :class="{ 'node-rejected--focus': data.isFocus }"
      :title="data.actionShort ? `Отклонено: ${data.actionShort}` : 'Отклонено'"
    >
      <span>{{ data.label }}</span>
      <Handle type="target" :position="Position.Left" :connectable="false" />
      <Handle type="source" :position="Position.Right" :connectable="false" />
    </div>
    <div class="rejected-wrap__caption">завершение отказом</div>
  </div>
</template>

<style scoped>
.rejected-wrap {
  width: 120px;
  height: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.node-rejected {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--reject-soft);
  border: 1.5px dashed var(--reject);
  opacity: 0.75;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--reject);
  font-weight: 500;
  cursor: pointer;
  transition: opacity 100ms ease, background 100ms ease, box-shadow 100ms ease;
}
.node-rejected:hover {
  opacity: 1;
  background: var(--reject-soft);
  box-shadow: 0 0 0 3px var(--reject-soft);
}
.node-rejected--focus {
  opacity: 1;
  background: var(--reject-soft);
  box-shadow: 0 0 0 3px var(--reject-soft);
  border-style: solid;
}
.rejected-wrap__caption {
  font-size: 10px;
  color: var(--reject);
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  pointer-events: none;
}
:deep(.vue-flow__handle) {
  opacity: 0;
  pointer-events: none;
}
</style>
