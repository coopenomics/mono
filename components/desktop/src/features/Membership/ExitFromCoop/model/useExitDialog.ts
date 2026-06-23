import { ref } from 'vue';

const showExitDialog = ref(false);

export function useExitDialog() {
  const open = () => {
    showExitDialog.value = true;
  };

  const close = () => {
    showExitDialog.value = false;
  };

  return {
    showDialog: showExitDialog,
    open,
    close,
  };
}
