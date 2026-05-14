<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { FileText, Wallet, Scale } from 'lucide-vue-next';

const props = defineProps<{
  data: {
    human: string;
    short: string;
    actor: string;
    role: string;
    isReject: boolean;
    isFocus: boolean;
    hasDocs: boolean;
    hasWalletMove: boolean;
    hasPosting: boolean;
  };
}>();

const hasAnyIndicator = computed(
  () => props.data.hasDocs || props.data.hasWalletMove || props.data.hasPosting,
);
</script>

<template>
  <div
    class="node-action"
    :class="{
      'node-action--reject': data.isReject,
      'node-action--focus': data.isFocus,
    }"
    :title="data.short"
  >
    <div class="node-action__human">{{ data.human }}</div>
    <div v-if="hasAnyIndicator" class="node-action__icons">
      <FileText
        v-if="data.hasDocs"
        :size="13"
        class="icon icon--doc"
        :aria-label="'документ'"
      />
      <Wallet
        v-if="data.hasWalletMove"
        :size="13"
        class="icon icon--wallet"
        :aria-label="'движение по кошельку'"
      />
      <Scale
        v-if="data.hasPosting"
        :size="13"
        class="icon icon--posting"
        :aria-label="'бухгалтерская проводка'"
      />
    </div>
    <Handle id="left" type="target" :position="Position.Left" :connectable="false" />
    <Handle id="right" type="source" :position="Position.Right" :connectable="false" />
  </div>
</template>

<style scoped>
.node-action {
  position: relative;
  width: 210px;
  height: 68px;
  padding: 8px 18px;
  /* pill-форма отличает «действие» от «статуса»-прямоугольника */
  border-radius: 34px;
  background: var(--edge-focus-soft);
  border: 1.5px solid var(--edge-focus-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: border-color 100ms ease, background 100ms ease, box-shadow 100ms ease;
  overflow: hidden;
}
.node-action:hover {
  border-color: var(--edge-focus);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.node-action--focus {
  border-color: var(--edge-focus);
  background: var(--edge-focus-soft);
  box-shadow: 0 0 0 3px var(--edge-focus-soft);
}
.node-action--reject {
  opacity: 0.75;
  border-style: dashed;
  border-color: var(--reject);
  background: var(--reject-soft);
}
.node-action--reject .node-action__human {
  color: var(--reject);
}
.node-action__human {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  line-height: 1.2;
  text-align: center;
  max-width: 100%;
}
.node-action__icons {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
}
.icon {
  display: inline-block;
}
.icon--doc { color: var(--accent); }
.icon--wallet { color: var(--edge-focus); }
.icon--posting { color: var(--edge-focus); }

:deep(.vue-flow__handle) {
  opacity: 0;
  pointer-events: none;
  width: 6px !important;
  height: 6px !important;
}
</style>
