import { defineStore } from 'pinia';
import { ref } from 'vue';

const namespace = 'commandPalette';

export const useCommandPaletteStore = defineStore(namespace, () => {
  const isOpen = ref<boolean>(false);

  function open(): void {
    isOpen.value = true;
  }
  function close(): void {
    isOpen.value = false;
  }
  function toggle(): void {
    isOpen.value = !isOpen.value;
  }

  return { isOpen, open, close, toggle };
});
