<template>
  <q-dialog
    :model-value="modelValue"
    :persistent="!closeOnBackdrop"
    :no-esc-dismiss="!closeOnEscape"
    :no-backdrop-dismiss="!closeOnBackdrop"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <q-card
      flat
      :class="['base-dialog', `base-dialog--${size}`]"
      :style="{ maxWidth: maxWidthBySize[size ?? 'md'] }"
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
}
.base-dialog__head {
  display: flex;
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
/* Между описанием диалога и первым инпутом — отступ. Между остальными
   детьми reserve-hint-space инпутов сам даёт достаточно воздуха.
   Селектор `:first-child + *` крепится ко второму ребёнку (даём ему
   margin-top), а не к первому — иначе inline `style="margin:0"` на
   `<p>`-описании перебивает CSS, и отступ ломается. */
.base-dialog__body {
  display: flex;
  flex-direction: column;
  padding-bottom: var(--p-2, 8px);
}
.base-dialog__body > :first-child + * {
  margin-top: var(--p-4, 16px);
}
/* Кнопки в footer ближе к body — без избыточного зазора */
.base-dialog__foot {
  padding-top: var(--p-2, 8px);
}
</style>
