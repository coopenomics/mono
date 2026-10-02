<template lang="pug">
//- Диалоги команд рабочего стола. Монтируется только диалог запущенной
//- команды: диалоги приложений тяжёлые, держать их все открытыми незачем.
component(v-if='active', :is='active.dialog', :key='active.id', ref='dialogRef')
</template>

<script setup lang="ts">
import { nextTick, ref, shallowRef } from 'vue';
import type { IWorkspaceCommand } from 'src/shared/lib/types/workspace';

interface OpenableDialog {
  openDialog: () => void;
}

const active = shallowRef<IWorkspaceCommand | null>(null);
const dialogRef = ref<OpenableDialog | null>(null);

/**
 * Открывает диалог команды. Повторный запуск той же команды открывает уже
 * смонтированный диалог заново.
 */
async function open(command: IWorkspaceCommand): Promise<void> {
  if (!command.dialog) return;
  active.value = command;
  await nextTick();
  dialogRef.value?.openDialog();
}

defineExpose({ open });
</script>
