import { computed } from 'vue';
import { LocalStorage } from 'quasar';
import { useSessionStore } from 'src/entities/Session';
import { useWebPushSubscriptionStore } from 'src/entities/WebPushSubscription';
import { useWebPushNotifications } from 'src/features/WebPushNotifications/model';

const PERMISSION_CHOICE_KEY = 'notification_permission_choice';

export interface INotificationPermissionChoice {
  hasDecided: boolean;
  choice: 'granted' | 'denied' | null;
  timestamp: number;
}

export function useNotificationPermissionDialog() {
  const sessionStore = useSessionStore();
  const store = useWebPushSubscriptionStore();
  const { subscribe, updateSupport, support } = useWebPushNotifications();

  // Получаем сохраненный выбор пользователя
  const getSavedChoice = (): INotificationPermissionChoice => {
    const saved = LocalStorage.getItem(PERMISSION_CHOICE_KEY);
    if (saved && typeof saved === 'object') {
      return saved as INotificationPermissionChoice;
    }
    return {
      hasDecided: false,
      choice: null,
      timestamp: 0,
    };
  };

  // Сохраняем выбор пользователя
  const saveChoice = (choice: 'granted' | 'denied') => {
    const choiceData: INotificationPermissionChoice = {
      hasDecided: true,
      choice,
      timestamp: Date.now(),
    };
    LocalStorage.setItem(PERMISSION_CHOICE_KEY, choiceData);
  };

  // Проверяем, нужно ли показывать диалог.
  // ВАЖНО: геттер ДОЛЖЕН быть чистым — никаких мутаций store здесь.
  // Раньше тут вызывался updateSupport(), который присваивал store.support
  // новый объект на каждое чтение computed. Побочный эффект в геттере давал
  // каскад инвалидаций/ре-рендеров после выдачи разрешения и подвешивал весь
  // UI (роутер менялся, а DOM «застывал»). Актуализация support вынесена в
  // showDialog().
  const shouldShowDialog = computed(() => {
    // Пользователь должен быть авторизован
    if (!sessionStore.isAuth) return false;

    // Браузер должен поддерживать push уведомления
    if (!support.value.isSupported) return false;

    // Проверяем сохраненный выбор
    const savedChoice = getSavedChoice();
    if (savedChoice.hasDecided) return false;

    // Браузер не должен уже иметь разрешение
    if (support.value.hasPermission) return false;

    // Должна быть возможность показать диалог запроса разрешения
    if (support.value.permission === 'denied') return false;

    return true;
  });

  // Показать диалог
  const showDialog = () => {
    // Актуализируем поддержку браузера ПЕРЕД проверкой предиката
    // (вынесено из computed shouldShowDialog, чтобы геттер оставался чистым).
    updateSupport();
    if (shouldShowDialog.value) {
      store.isPermissionDialogVisible = true;
    }
  };

  // Скрыть диалог
  const hideDialog = () => {
    store.isPermissionDialogVisible = false;
  };

  // Обработка согласия пользователя
  const handleAllow = async () => {
    // Немедленно закрываем диалог и сохраняем выбор пользователя
    saveChoice('granted');
    hideDialog();

    // Выполняем подписку в фоне
    try {
      console.log('handleAllow - начинаем фоновую подписку');
      const success = await subscribe();
      console.log('success', success);
      if (!success) {
        console.log('saveChoice denied - подписка не удалась');
        // Если подписка не удалась, меняем выбор на denied
        // чтобы диалог мог появиться снова при необходимости
        saveChoice('denied');
      }
    } catch (error) {
      console.error('Ошибка при разрешении уведомлений:', error);
      console.log('saveChoice denied - ошибка подписки');
      // При ошибке тоже меняем на denied
      saveChoice('denied');
    }
  };

  // Обработка отказа пользователя
  const handleDeny = () => {
    saveChoice('denied');
    hideDialog();
  };

  // Сброс выбора (для тестирования)
  const resetChoice = () => {
    LocalStorage.removeItem(PERMISSION_CHOICE_KEY);
  };

  return {
    // Состояние
    isDialogVisible: computed(() => store.isPermissionDialogVisible),
    isProcessing: computed(() => store.isPermissionDialogProcessing),
    shouldShowDialog,

    // Методы
    showDialog,
    hideDialog,
    handleAllow,
    handleDeny,
    resetChoice,
    getSavedChoice,
  };
}
