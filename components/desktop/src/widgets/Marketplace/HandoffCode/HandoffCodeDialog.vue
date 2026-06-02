<script lang="ts" setup>
import { computed } from 'vue';
import { BaseDialog } from 'src/shared/ui/base';
import { HANDOFF_CODE_COPY, type AccountHandoffKind } from './copy';
import HandoffCodeContent from './HandoffCodeContent.vue';

/**
 * Диалог account-bound кода передачи — тот же QR, что и на отдельной странице,
 * но всплывающим окном из шапки (заказчик: «Мои заказы» / деталь заказа;
 * поставщик: «Подготовка отгрузки»). Код всегда под рукой в одном месте, без
 * перехода на отдельную страницу. Заголовок — из `HANDOFF_CODE_COPY` по `kind`.
 */

const props = defineProps<{
  modelValue: boolean;
  coopname: string;
  kind: AccountHandoffKind;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const title = computed(() => HANDOFF_CODE_COPY[props.kind].dialogTitle);
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue",
  :title="title",
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  .handoff-code-dialog
    HandoffCodeContent(:coopname="coopname", :kind="kind")
</template>

<style scoped lang="scss">
.handoff-code-dialog {
  display: flex;
  justify-content: center;
  padding: var(--p-4, 16px) 0;
}
</style>
