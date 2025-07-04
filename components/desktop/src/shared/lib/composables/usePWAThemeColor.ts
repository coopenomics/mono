import { computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { updatePWAThemeColor } from '../utils/theme';

/**
 * Composable для автоматического обновления PWA theme-color
 * при изменении темы Quasar
 */
export function usePWAThemeColor() {
  const $q = useQuasar();
  const isDark = computed(() => $q.dark.isActive);

  // Обновляем theme-color при изменении темы
  watch(
    isDark,
    (newIsDark) => {
      updatePWAThemeColor(newIsDark);
    },
    { immediate: true },
  );

  return {
    isDark,
    updatePWAThemeColor,
  };
}
