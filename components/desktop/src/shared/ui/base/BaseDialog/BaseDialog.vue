<template>
  <q-dialog
    :model-value="modelValue"
    :persistent="!closeOnBackdrop"
    :no-esc-dismiss="!closeOnEscape"
    :no-backdrop-dismiss="!closeOnBackdrop"
    :maximized="maximized"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <q-card
      flat
      :class="['base-dialog', maximized ? 'base-dialog--maximized' : `base-dialog--${size}`]"
      :style="maximized ? undefined : { maxWidth: maxWidthBySize[size ?? 'md'] }"
    >
      <q-card-section
        v-if="title || $slots.head || !hideCloseButton"
        class="base-dialog__head"
      >
        <div class="base-dialog__title">
          <slot name="head">{{ title }}</slot>
        </div>
        <q-btn
          v-if="!hideCloseButton"
          flat
          round
          dense
          icon="close"
          aria-label="Закрыть"
          @click="emit('update:modelValue', false)"
        />
      </q-card-section>

      <q-card-section class="base-dialog__body">
        <slot />
      </q-card-section>

      <q-card-actions v-if="$slots.footer" class="base-dialog__foot" align="right">
        <slot name="footer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import type { BaseDialogProps, BaseDialogSize } from './BaseDialog.types';

withDefaults(defineProps<BaseDialogProps>(), {
  size: 'md',
  closeOnBackdrop: true,
  closeOnEscape: true,
  hideCloseButton: false,
  maximized: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const maxWidthBySize: Record<BaseDialogSize, string> = {
  sm: '360px',
  md: '440px',
  lg: '640px',
};
</script>

<style scoped>
.base-dialog {
  width: 100%;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--p-6, 48px));
}
/* Maximized: контейнер растягивается на весь экран, контент скроллится. */
.base-dialog--maximized {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
}
.base-dialog--maximized .base-dialog__foot {
  flex-shrink: 0;
}
.base-dialog__head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding-bottom: 0;
}
.base-dialog__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  letter-spacing: var(--p-ls-h3);
  color: var(--p-ink);
}
.base-dialog__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: var(--p-2, 8px);
}
.base-dialog__body > :first-child + * {
  margin-top: var(--p-4, 16px);
}
.base-dialog__foot {
  flex: 0 0 auto;
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-top: 1px solid var(--p-line);
  background: var(--p-surface);
}
</style>
