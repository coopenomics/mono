<template lang="pug">
.edu-row-actions
  BaseButton(variant="ghost" size="sm" icon-only :aria-label="upLabel" :disabled="!canUp || busy" @click="emit('up')")
    template(#icon-left)
      q-icon(name="arrow_upward" size="18px")
  BaseButton(variant="ghost" size="sm" icon-only :aria-label="downLabel" :disabled="!canDown || busy" @click="emit('down')")
    template(#icon-left)
      q-icon(name="arrow_downward" size="18px")
  //- У кнопки-иконки содержимое по умолчанию не рисуется — меню кладётся в её слот `menu`.
  BaseButton(variant="ghost" size="sm" icon-only :aria-label="$t('edubridge.adminSectionsPage.more')" :disabled="busy")
    template(#icon-left)
      q-icon(name="more_vert" size="18px")
    template(#menu)
      q-menu(anchor="bottom right" self="top right")
        q-list(dense)
          q-item(clickable v-close-popup @click="emit('rename')")
            q-item-section {{ $t('edubridge.adminSectionsPage.rename') }}
          q-item(clickable v-close-popup @click="emit('toggle')")
            q-item-section {{ archived ? $t('edubridge.adminSectionsPage.unarchive') : $t('edubridge.adminSectionsPage.archive') }}
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

/** Действия строки справочника — раздела или уровня: порядок стрелками, остальное в меню. */
defineProps<{ canUp: boolean; canDown: boolean; archived: boolean; busy: boolean; upLabel: string; downLabel: string }>();
const emit = defineEmits<{ up: []; down: []; rename: []; toggle: [] }>();
</script>

<style scoped>
.edu-row-actions {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  flex-shrink: 0;
}
</style>
