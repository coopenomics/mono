import { computed, ref } from 'vue';
import { useSessionStore } from 'src/entities/Session';

/**
 * Сбор паспортных данных перед действием, которому паспорт обязателен
 * (подписание договора матответственности председателем участка или доверенным
 * лицом). Если паспорт уже есть в профиле пайщика — действие выполняется сразу,
 * окно не показывается. Если нет — открывается диалог; после сохранения паспорта
 * (saveMyPassport) запускается отложенное действие. Существующие данные не
 * перезатираются — это гарантирует бэкенд.
 */
export function useRequirePassport() {
  const session = useSessionStore();
  const passportDialogOpen = ref(false);
  let deferredAction: (() => void | Promise<void>) | null = null;

  const hasPassport = computed(() => !!session.privateAccount?.individual_data?.passport);

  async function requirePassport(action: () => void | Promise<void>): Promise<void> {
    if (hasPassport.value) {
      await action();
      return;
    }
    deferredAction = action;
    passportDialogOpen.value = true;
  }

  async function onPassportSaved(): Promise<void> {
    const action = deferredAction;
    deferredAction = null;
    if (action) await action();
  }

  return { passportDialogOpen, hasPassport, requirePassport, onPassportSaved };
}
