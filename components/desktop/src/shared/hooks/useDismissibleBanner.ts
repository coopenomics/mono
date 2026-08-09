import { ref, type Ref } from 'vue';
import { LocalStorage } from 'quasar';

/**
 * Подсказка-баннер (`.banner--info`), которую пользователь может скрыть
 * навсегда. Состояние читается из LocalStorage синхронно — если подсказку
 * уже закрыли, она не появляется вообще, без мигания на onMounted.
 *
 * Канон стола: на каждой странице сверху — инфо-баннер с крестиком скрытия.
 * Ключ уникален per-страница (`mp:<page>:banner-dismissed`).
 */
export interface DismissibleBanner {
  /** true — подсказку скрыли, баннер не показываем. */
  dismissed: Ref<boolean>;
  /** Скрыть подсказку навсегда (пишет в LocalStorage). */
  dismiss: () => void;
}

export function useDismissibleBanner(storageKey: string): DismissibleBanner {
  const dismissed = ref(LocalStorage.getItem(storageKey) === true);

  function dismiss(): void {
    dismissed.value = true;
    LocalStorage.set(storageKey, true);
  }

  return { dismissed, dismiss };
}
