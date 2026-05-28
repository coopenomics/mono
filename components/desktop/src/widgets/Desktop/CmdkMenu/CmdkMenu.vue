<template lang="pug">
//- Canon-обёртка: глобальная палитра команд по ⌘K / Ctrl+K.
//- UI — canon CommandPalette из shared/ui/domain.
//- Данные и навигация — из useCmdkMenuStore (роли, conditions, переключение
//- рабочих столов, push в роутер, переключение по горячей клавише).
CommandPalette(
  v-model='showDialog',
  :workspaces='workspaces',
  placeholder='Поиск рабочих столов и страниц…'
  @select-workspace='handleSelectWorkspace',
  @select-page='handleSelectPage'
)
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useCmdkMenuStore } from 'src/entities/CmdkMenu/model';
import type { CommandPaletteWorkspace } from 'src/shared/ui/domain/CommandPalette';

const cmdkStore = useCmdkMenuStore();
const { showDialog, groupedItems } = storeToRefs(cmdkStore);

const workspaces = computed<CommandPaletteWorkspace[]>(() =>
  groupedItems.value.map((group) => ({
    name: group.workspaceName,
    title: group.title,
    icon: group.icon,
    isActive: group.isActive,
    pages: group.pages.map((page) => ({
      name: page.name,
      title: page.meta?.title ?? page.name,
      icon: page.meta?.icon,
      shortcut: page.shortcut,
    })),
  })),
);

function handleSelectWorkspace(workspaceName: string): void {
  cmdkStore.selectGroupByName(workspaceName);
}

function handleSelectPage(workspaceName: string, pageName: string): void {
  const group = groupedItems.value.find((g) => g.workspaceName === workspaceName);
  const page = group?.pages.find((p) => p.name === pageName);
  if (!page) return;
  cmdkStore.selectPage(workspaceName, page);
}

onMounted(() => {
  cmdkStore.initGlobalKeydown();
});

onUnmounted(() => {
  cmdkStore.destroyGlobalKeydown();
});
</script>
