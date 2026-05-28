<template lang="pug">
q-dialog(
  :model-value='modelValue',
  position='right',
  :persistent='!clickOutsideClose',
  :maximized='isMobile',
  transition-show='slide-left',
  transition-hide='slide-right',
  @update:model-value='(v) => emit("update:modelValue", v)'
)
  .details-drawer(:style='drawerStyle', role='dialog', :aria-label='title')
    header.details-drawer__header(v-if='title || closable || hasActionsSlot')
      h3.details-drawer__title(v-if='title') {{ title }}
      span.details-drawer__spacer(v-else)
      .details-drawer__actions(v-if='hasActionsSlot')
        slot(name='actions')
      button.details-drawer__close(
        v-if='closable',
        type='button',
        aria-label='Закрыть',
        @click='close'
      )
        q-icon(name='close', size='20px')

    .details-drawer__body
      slot

    footer.details-drawer__footer(v-if='hasFooterSlot')
      slot(name='footer')
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { useQuasar } from 'quasar';
import type { DetailsDrawerProps } from './DetailsDrawer.types';

const props = withDefaults(defineProps<DetailsDrawerProps>(), {
  width: 480,
  closable: true,
  clickOutsideClose: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const slots = useSlots();
const $q = useQuasar();

const isMobile = computed(() => $q.screen.xs);
const hasActionsSlot = computed(() => !!slots.actions);
const hasFooterSlot = computed(() => !!slots.footer);

const drawerStyle = computed(() => ({
  width: isMobile.value ? '100vw' : `${props.width}px`,
  maxWidth: '100vw',
}));

function close(): void {
  emit('update:modelValue', false);
}
</script>

<style scoped>
.details-drawer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--p-surface);
  color: var(--p-ink);
  box-shadow: var(--p-elev-3);
}

.details-drawer__header {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-bottom: 1px solid var(--p-line);
  flex: 0 0 auto;
}

.details-drawer__title {
  flex: 1 1 auto;
  margin: 0;
  font-size: var(--p-fs-h6, 16px);
  line-height: var(--p-lh-h6, 1.4);
  font-weight: 600;
  color: var(--p-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.details-drawer__spacer {
  flex: 1 1 auto;
}

.details-drawer__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
}

.details-drawer__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--p-r-sm, 8px);
  background: transparent;
  color: var(--p-ink-2);
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.details-drawer__close:hover {
  background: var(--p-surface-2);
  color: var(--p-ink);
}

.details-drawer__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: var(--p-4, 16px);
}

.details-drawer__footer {
  flex: 0 0 auto;
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-top: 1px solid var(--p-line);
  background: var(--p-surface);
}
</style>
