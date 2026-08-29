<template>
  <button
    type="button"
    class="icon-btn tabbar__arrow"
    :class="{ 'tabbar__arrow--faded': disabled }"
    :disabled="disabled"
    :aria-label="direction === 'left' ? 'Прокрутить вкладки влево' : 'Прокрутить вкладки вправо'"
    @click="emit('scroll')"
  >
    <q-icon :name="direction === 'left' ? 'chevron_left' : 'chevron_right'" size="20px" />
  </button>
</template>

<script setup lang="ts">
/**
 * Стрелка прокрутки полосы вкладок. Общая для обоих таб-баров — канонного
 * PageTabs и меню второго уровня SecondLevelTabs; логика доступности живёт в
 * useTabsScroll.
 */
defineProps<{
  direction: 'left' | 'right';
  /** Крутить в эту сторону уже некуда — стрелка гаснет, но места не освобождает */
  disabled: boolean;
}>();

const emit = defineEmits<{ scroll: [] }>();
</script>
