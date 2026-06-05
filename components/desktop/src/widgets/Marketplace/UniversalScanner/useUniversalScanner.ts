import { ref } from 'vue';

/**
 * Singleton-состояние всплывающего универсального сканера стола ПВЗ. Открывается
 * из пункта меню «Сканировать QR» (через действие `marketplaceUniversalScan`,
 * как кнопка «Поддержка») и из палитры команд — поэтому состояние общее, а сам
 * диалог смонтирован один раз в layout (UniversalScannerHost).
 */
const isOpen = ref(false);

export function useUniversalScanner() {
  return {
    isOpen,
    open: (): void => {
      isOpen.value = true;
    },
    close: (): void => {
      isOpen.value = false;
    },
  };
}
