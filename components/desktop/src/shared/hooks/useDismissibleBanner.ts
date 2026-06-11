import { ref } from 'vue';

/**
 * Скрываемый баннер-подсказка страницы: состояние сохраняется в LocalStorage
 * (синхронное чтение при инициализации — без восстановления в onMounted,
 * чтобы исключить мигание).
 */
export function useDismissibleBanner(storageKey: string) {
  const isDismissedInitially =
    typeof window !== 'undefined' && !!window.localStorage && localStorage.getItem(storageKey) === 'true';

  const dismissed = ref(isDismissedInitially);

  function dismiss() {
    dismissed.value = true;
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // localStorage недоступен (SSR/приватный режим) — баннер скрыт до перезагрузки
    }
  }

  return { dismissed, dismiss };
}
