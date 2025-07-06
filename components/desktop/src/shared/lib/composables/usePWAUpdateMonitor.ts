import { ref, onMounted, onUnmounted } from 'vue';

export function usePWAUpdateMonitor() {
  const updateAvailable = ref(false);
  const isUpdating = ref(false);

  let registration: ServiceWorkerRegistration | null = null;
  let refreshing = false;

  const checkForUpdates = async () => {
    if ('serviceWorker' in navigator && registration) {
      try {
        await registration.update();
      } catch (error) {
        console.error('PWA: Error checking for updates:', error);
      }
    }
  };

  const handleControllerChange = () => {
    if (refreshing) return;
    console.log('PWA: Service worker controller changed, reloading page');
    refreshing = true;
    window.location.reload();
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'SW_UPDATED') {
      console.log('PWA: Received SW update notification');
      updateAvailable.value = true;
    }
  };

  const forceUpdate = () => {
    if (!updateAvailable.value) return;

    isUpdating.value = true;
    console.log('PWA: Forcing update...');

    // Отправляем сообщение service worker для принудительного обновления
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SKIP_WAITING',
      });
    }

    // Перезагружаем через короткое время если автоматическое обновление не сработало
    setTimeout(() => {
      if (!refreshing) {
        console.log('PWA: Manual reload after timeout');
        window.location.reload();
      }
    }, 2000);
  };

  onMounted(() => {
    if ('serviceWorker' in navigator) {
      // Получаем текущую регистрацию
      navigator.serviceWorker.ready.then((reg) => {
        registration = reg;
        console.log('PWA: Service worker ready for monitoring');
      });

      // Слушаем изменения контроллера
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        handleControllerChange,
      );

      // Слушаем сообщения от service worker
      navigator.serviceWorker.addEventListener('message', handleMessage);

      // Проверяем обновления периодически (каждые 30 секунд)
      const interval = setInterval(checkForUpdates, 30000);

      // Очищаем интервал при размонтировании
      onUnmounted(() => {
        clearInterval(interval);
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          handleControllerChange,
        );
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      });
    }
  });

  return {
    updateAvailable,
    isUpdating,
    forceUpdate,
    checkForUpdates,
  };
}
