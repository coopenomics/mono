<script setup lang="ts">
import { computed } from 'vue';

interface IProps {
  title?: string;
  show_close?: boolean;
}

const props = withDefaults(defineProps<IProps>(), {
  title: '',
  show_close: true,
});

const title = computed(() => props.title);
</script>

<template lang="pug">
//- Canon-оболочка диалога. Визуально соответствует shared/ui/base/BaseDialog.
//- API совместим со старым ModalBase: title / show_close / slot=default,
//- slot=title — поэтому подходит как drop-in для 40+ legacy call-site'ов
//- (внешний q-dialog держит родитель). Новые диалоги пишем на BaseDialog
//- с v-model:modelValue.
q-card.modal-base
  .modal-base__head(v-if='title || $slots.title || show_close')
    .modal-base__title
      slot(v-if='$slots.title', name='title')
      template(v-else) {{ title }}
    q-btn.modal-base__close(
      v-if='show_close',
      v-close-popup,
      flat,
      round,
      dense,
      icon='close',
      aria-label='Закрыть'
    )
      q-tooltip Закрыть
  slot
</template>

<style scoped lang="scss">
.modal-base {
  width: 100%;
  max-width: 440px;
  background: var(--p-surface);
  color: var(--p-ink);
  border-radius: var(--p-r-md, 12px);
  box-shadow: var(--p-shadow-modal);
}
.modal-base__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px) 0;
}
.modal-base__title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--p-fs-h3);
  font-weight: 600;
  letter-spacing: var(--p-ls-h3);
  color: var(--p-ink);
  /* Длинные заголовки переносятся, не обрезаются. */
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.3;
}
.modal-base__close {
  flex: 0 0 auto;
  color: var(--p-ink-3);
}
</style>
