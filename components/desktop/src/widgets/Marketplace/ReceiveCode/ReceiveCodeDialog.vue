<script lang="ts" setup>
import { BaseDialog } from 'src/shared/ui/base';
import ReceiveCodeContent from './ReceiveCodeContent.vue';

/**
 * Диалог «Получить заказ» — тот же QR-код, что и на отдельной странице, но
 * всплывающим окном. Открывается кнопкой из шапки «Моих заказов» и из шапки
 * детали заказа: код всегда под рукой в одном месте (шапка), без перехода на
 * отдельную страницу и проблемы «как вернуться назад».
 */

defineProps<{
  modelValue: boolean;
  coopname: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue",
  title="Получить заказ",
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  .receive-code-dialog
    ReceiveCodeContent(:coopname="coopname")
</template>

<style scoped lang="scss">
.receive-code-dialog {
  display: flex;
  justify-content: center;
  padding: var(--p-4, 16px) 0;
}
</style>
