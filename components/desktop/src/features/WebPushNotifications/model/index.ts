import { ref, computed } from 'vue';
import { useWebPushSubscriptionStore } from 'src/entities/WebPushSubscription';
import { webPushSubscriptionApi } from 'src/entities/WebPushSubscription';
import { webPushNotificationsMutations } from '../api';
import { useSessionStore } from 'src/entities/Session';
import { SuccessAlert, FailAlert } from 'src/shared/api/alerts';
import { env } from 'src/shared/config';
import type {
  ICreateSubscriptionData,
  IPushNotificationSupport,
  IGetUserSubscriptionsInput,
} from 'src/entities/WebPushSubscription';

export function useWebPushNotifications() {
  const store = useWebPushSubscriptionStore();
  const sessionStore = useSessionStore();

  const isProcessing = ref(false);

  // Endpoint push-подписки ИМЕННО этого браузера/устройства (а не любого
  // устройства пользователя). Заполняется через refreshDeviceState() и после
  // subscribe(). Нужен, чтобы отличать «на этом устройстве подписан» от «у
  // аккаунта вообще есть подписка на другом устройстве».
  const thisDeviceEndpoint = ref<string | null>(null);

  // Есть ли РЕАЛЬНО зарегистрированный/активный Service Worker (а не просто
  // наличие API в браузере). store.support.isSupported = true как только есть
  // `serviceWorker in navigator`, но в dev/без-PWA сам SW не зарегистрирован
  // (register-service-worker.ts вешает его только в проде/ENABLE_PWA_DEV) —
  // тогда подписка физически невозможна, и кнопку показывать нельзя
  // (иначе клик молча умирает на «Service Worker не активен»).
  // Заполняется в refreshDeviceState() (async — getRegistrations).
  const hasActiveServiceWorker = ref(false);

  // Подписан ли ИМЕННО ЭТОТ браузер (его endpoint есть в активных подписках
  // аккаунта). store.isSubscribed = «есть хоть одна подписка у аккаунта» —
  // непригоден для multi-device: на втором устройстве он true из-за первого.
  const isThisDeviceSubscribed = computed(
    () =>
      !!thisDeviceEndpoint.value &&
      store.subscriptions.some(
        (sub) => sub.endpoint === thisDeviceEndpoint.value && sub.isActive,
      ),
  );

  // Computed свойства
  const canSubscribe = computed(
    () =>
      store.support.canSubscribe &&
      sessionStore.isAuth &&
      !isThisDeviceSubscribed.value,
  );

  const canUnsubscribe = computed(
    () => isThisDeviceSubscribed.value && sessionStore.isAuth,
  );

  const subscriptionStatus = computed(() => {
    if (!store.support.isSupported) return 'unsupported';
    if (!store.support.hasPermission) return 'permission_denied';
    if (store.isSubscribed) return 'subscribed';
    return 'not_subscribed';
  });

  // Методы работы с состоянием
  const checkPushNotificationSupport = (): IPushNotificationSupport => {
    const result: IPushNotificationSupport = {
      isSupported: false,
      hasPermission: false,
      permission: 'default',
      hasServiceWorker: false,
      canSubscribe: false,
    };

    try {
      // Проверяем поддержку Push API
      if (!('serviceWorker' in navigator)) {
        result.error = 'Service Worker не поддерживается';
        return result;
      }

      if (!('PushManager' in window)) {
        result.error = 'Push API не поддерживается';
        return result;
      }

      if (!('Notification' in window)) {
        result.error = 'Notifications API не поддерживается';
        return result;
      }

      result.isSupported = true;
      result.hasServiceWorker = true;
      result.permission = Notification.permission;
      result.hasPermission = Notification.permission === 'granted';
      result.canSubscribe = result.hasPermission && result.isSupported;
    } catch (err) {
      result.error = `Ошибка проверки поддержки: ${err}`;
    }

    return result;
  };

  const updateSupport = () => {
    store.support = checkPushNotificationSupport();
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      if (!store.support.isSupported) {
        throw new Error('Push уведомления не поддерживаются');
      }

      // Добавляем timeout на случай, если пользователь не взаимодействует с диалогом
      const permission = await Promise.race([
        Notification.requestPermission(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Пользователь не ответил на запрос разрешения в течение 30 секунд'));
          }, 15000);
        }),
      ]);

      store.support.permission = permission;
      store.support.hasPermission = permission === 'granted';
      store.support.canSubscribe =
        store.support.hasPermission && store.support.isSupported;

      if (permission === 'granted') {
        SuccessAlert('Разрешение на уведомления получено');
      } else {
        FailAlert('Разрешение на уведомления отклонено');
      }

      return permission === 'granted';
    } catch (err) {
      store.error = `Ошибка запроса разрешения: ${err}`;
      FailAlert(err);
      return false;
    }
  };

  /**
   * Сброс разрешения для тестирования
   * Программно полностью сбросить разрешение браузера нельзя,
   * но можно форсировать запрос нового разрешения
   */
  const resetPermission = async (): Promise<void> => {
    try {
      // Сбрасываем состояние в store
      store.support.permission = 'default';
      store.support.hasPermission = false;
      store.support.canSubscribe = false;

      // Отписываемся от текущих подписок
      const registration = await getServiceWorkerRegistration();
      if (registration) {
        const browserSubscription =
          await registration.pushManager.getSubscription();
        if (browserSubscription) {
          await browserSubscription.unsubscribe();
        }
      }

      // Очищаем подписки в store
      store.subscriptions = [];

      console.log(
        'Разрешение сброшено. Теперь можно запросить новое разрешение.',
      );
      SuccessAlert(
        'Разрешение сброшено. Теперь можно запросить новое разрешение.',
      );
    } catch (error) {
      console.error('Ошибка сброса разрешения:', error);
      FailAlert(error);
    }
  };

  /**
   * Форсированный запрос разрешения (игнорирует текущее состояние)
   */
  const forceRequestPermission = async (): Promise<boolean> => {
    try {
      if (!store.support.isSupported) {
        throw new Error('Push уведомления не поддерживаются');
      }

      console.log('Форсированный запрос разрешения...');

      // Добавляем timeout на случай, если пользователь не взаимодействует с диалогом
      const permission = await Promise.race([
        Notification.requestPermission(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Пользователь не ответил на запрос разрешения в течение 30 секунд'));
          }, 30000);
        }),
      ]);

      store.support.permission = permission;
      store.support.hasPermission = permission === 'granted';
      store.support.canSubscribe =
        store.support.hasPermission && store.support.isSupported;

      if (permission === 'granted') {
        SuccessAlert('Разрешение на уведомления получено');
      } else {
        FailAlert('Разрешение на уведомления отклонено');
      }

      return permission === 'granted';
    } catch (err) {
      store.error = `Ошибка запроса разрешения: ${err}`;
      FailAlert(err);
      return false;
    }
  };

  const loadUserSubscriptions = async () => {
    if (!sessionStore.isAuth || !sessionStore.username) return;

    try {
      store.isLoading = true;
      store.error = null;

      const data: IGetUserSubscriptionsInput = {
        username: sessionStore.username,
      };

      store.subscriptions =
        await webPushSubscriptionApi.getUserWebPushSubscriptions(data);
    } catch (err) {
      store.error = `Ошибка загрузки подписок: ${err}`;
      console.error('Ошибка загрузки подписок:', err);
    } finally {
      store.isLoading = false;
    }
  };

  /**
   * Преобразование base64 URL в Uint8Array для VAPID ключа
   */
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  /**
   * Получение service worker registration
   */
  const getServiceWorkerRegistration =
    async (): Promise<ServiceWorkerRegistration | null> => {
      try {
        if (!('serviceWorker' in navigator)) {
          return null;
        }

        // Если ни один Service Worker не зарегистрирован (обычный dev-режим без
        // PWA — register-service-worker.ts регистрирует SW только в проде или
        // при ENABLE_PWA_DEV=true), то navigator.serviceWorker.ready НИКОГДА не
        // зарезолвится. Не ждём 5 секунд впустую и не шумим в консоль ошибкой —
        // выходим сразу и тихо.
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length === 0) {
          return null;
        }

        // Добавляем timeout для navigator.serviceWorker.ready
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Service Worker не готов в течение 5 секунд'));
            }, 5000);
          }),
        ]);

        return registration;
      } catch (error) {
        // Недоступность Service Worker — не ошибка приложения, лишь отсутствие
        // условий для push-подписки. Предупреждение, а не error.
        console.warn('Service Worker недоступен, push-подписка пропущена:', error);
        return null;
      }
    };

  /**
   * Создание push подписки в браузере
   */
  const createBrowserSubscription =
    async (): Promise<PushSubscription | null> => {
      try {
        const registration = await getServiceWorkerRegistration();
        if (!registration) {
          // Service Worker недоступен (например, dev без PWA) — это не сбой
          // пользователя. Тихо возвращаем null, выше это обработается как
          // «подписка недоступна» без красной ошибки.
          return null;
        }

        // Проверяем существующую подписку
        const existingSubscription =
          await registration.pushManager.getSubscription();
        if (existingSubscription) {
          return existingSubscription;
        }

        // Получаем VAPID ключ из окружения
        const vapidPublicKey = env.VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          throw new Error('VAPID_PUBLIC_KEY не найден в конфигурации');
        }

        // Конвертируем VAPID ключ в Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

        // Создаем новую подписку
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any,
        });

        return subscription;
      } catch (error) {
        console.error('Ошибка создания подписки в браузере:', error);
        throw error;
      }
    };

  /**
   * Преобразование PushSubscription в ICreateSubscriptionData
   */
  const convertPushSubscriptionToData = (
    subscription: PushSubscription,
  ): ICreateSubscriptionData => {
    const p256dh = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');

    if (!p256dh || !auth) {
      throw new Error('Не удалось получить ключи подписки');
    }

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
        auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
      },
      userAgent: navigator.userAgent,
    };
  };

  /**
   * Подписка на push уведомления
   */
  const subscribe = async (): Promise<boolean> => {
    if (isProcessing.value) return false;

    try {
      isProcessing.value = true;

      // Проверяем поддержку
      if (!store.support.isSupported) {
        throw new Error(
          store.support.error || 'Push уведомления не поддерживаются',
        );
      }
      console.log('store.support.hasPermission', store.support.hasPermission);
      // Запрашиваем разрешение если нужно
      if (!store.support.hasPermission) {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      // Создаем подписку в браузере
      const browserSubscription = await createBrowserSubscription();
      if (!browserSubscription) {
        // Подписка недоступна в текущем окружении (нет активного Service
        // Worker). Это НЕ ошибка пользователя — не показываем красный алерт,
        // просто молча выходим, чтобы push никогда не влиял на работу
        // остального приложения.
        console.warn('Push-подписка недоступна: Service Worker не активен');
        return false;
      }

      // Запоминаем endpoint этого устройства для device-aware проверок
      thisDeviceEndpoint.value = browserSubscription.endpoint;

      // Преобразуем в формат для сервера
      const subscriptionData =
        convertPushSubscriptionToData(browserSubscription);

      // Сохраняем на сервере
      const result =
        await webPushNotificationsMutations.createWebPushSubscription(
          subscriptionData,
          sessionStore.username,
        );

      if (result.success && result.subscription) {
        // Ищем существующую подписку с таким же endpoint
        const existingIndex = store.subscriptions.findIndex(
          (sub) => sub.endpoint === result.subscription.endpoint,
        );

        if (existingIndex !== -1) {
          // Обновляем существующую подписку
          store.subscriptions[existingIndex] = result.subscription;
        } else {
          // Добавляем новую подписку
          store.subscriptions.push(result.subscription);
        }

        SuccessAlert('Подписка на уведомления успешно создана');
        return true;
      } else {
        throw new Error(result.message || 'Ошибка создания подписки');
      }
    } catch (error) {
      console.error('Ошибка подписки:', error);
      FailAlert(error);
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * Отписка от push уведомлений
   */
  const unsubscribe = async (): Promise<boolean> => {
    if (isProcessing.value) return false;

    try {
      isProcessing.value = true;

      // Получаем текущую браузерную подписку
      const registration = await getServiceWorkerRegistration();
      if (!registration) {
        throw new Error('Service Worker не найден');
      }

      const browserSubscription =
        await registration.pushManager.getSubscription();
      if (!browserSubscription) {
        throw new Error('Браузерная подписка не найдена');
      }

      // Ищем соответствующую подписку в store по endpoint
      const correspondingSubscription = store.subscriptions.find(
        (sub) => sub.endpoint === browserSubscription.endpoint && sub.isActive,
      );

      if (!correspondingSubscription) {
        throw new Error('Соответствующая подписка в store не найдена');
      }

      // Деактивируем на сервере
      await webPushNotificationsMutations.deactivateWebPushSubscription(
        correspondingSubscription.id,
      );

      // Обновляем локальное состояние
      correspondingSubscription.isActive = false;

      // Отписываемся в браузере
      await browserSubscription.unsubscribe();

      SuccessAlert('Подписка на уведомления отключена');
      return true;
    } catch (error) {
      console.error('Ошибка отписки:', error);
      FailAlert(error);
      return false;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * Определить endpoint текущего устройства из браузерной подписки.
   * Без этого isThisDeviceSubscribed не может отличить это устройство от других.
   */
  const refreshDeviceState = async (): Promise<void> => {
    try {
      updateSupport();
      const registration = await getServiceWorkerRegistration();
      hasActiveServiceWorker.value = !!registration;
      if (!registration) {
        thisDeviceEndpoint.value = null;
        return;
      }
      const browserSubscription =
        await registration.pushManager.getSubscription();
      thisDeviceEndpoint.value = browserSubscription?.endpoint ?? null;
    } catch (error) {
      console.warn('Не удалось определить состояние устройства:', error);
      hasActiveServiceWorker.value = false;
      thisDeviceEndpoint.value = null;
    }
  };

  /**
   * Переподписка: сбрасывает старую браузерную подписку (и деактивирует её на
   * сервере) и создаёт свежую. Нужна, когда в БД лежит устаревший/неправильный
   * subscriber, из-за чего push «доставляется», но не приходит.
   */
  const resubscribe = async (): Promise<boolean> => {
    if (isProcessing.value) return false;
    try {
      const registration = await getServiceWorkerRegistration();
      if (registration) {
        const browserSubscription =
          await registration.pushManager.getSubscription();
        if (browserSubscription) {
          // Деактивируем старую запись на сервере, чтобы не плодить мёртвые.
          const stale = store.subscriptions.find(
            (sub) => sub.endpoint === browserSubscription.endpoint,
          );
          if (stale) {
            try {
              await webPushNotificationsMutations.deactivateWebPushSubscription(
                stale.id,
              );
              stale.isActive = false;
            } catch (e) {
              console.warn('Не удалось деактивировать старую подписку:', e);
            }
          }
          await browserSubscription.unsubscribe();
          thisDeviceEndpoint.value = null;
        }
      }
    } catch (error) {
      console.warn('Ошибка сброса старой подписки при переподписке:', error);
      // Не прерываем — пробуем подписаться заново в любом случае.
    }
    // Создаём свежую подписку (запросит разрешение при необходимости).
    return await subscribe();
  };

  /**
   * Инициализация системы push уведомлений
   */
  const initialize = async () => {
    updateSupport();
    if (sessionStore.isAuth) {
      await loadUserSubscriptions();
    }
    await refreshDeviceState();
  };

  /**
   * Автоматическая подписка при первом входе (если поддерживается)
   */
  const autoSubscribeIfSupported = async (): Promise<void> => {
    try {
      console.log('=== Начало autoSubscribeIfSupported ===');

      // Проверяем поддержку
      updateSupport();

      // ВАЖНО: проверяем только поддержку, НЕ store.isSubscribed. isSubscribed
      // = «у аккаунта есть подписка на любом устройстве» — на новом устройстве
      // он true из-за старого, и тогда новое устройство НИКОГДА не подпишется
      // (корень бага «пуш приходит только на одно устройство»). subscribe()
      // идемпотентен (upsert по endpoint), поэтому повторный вызов на уже
      // подписанном устройстве безопасен.
      if (!store.support.isSupported) {
        console.log('Push не поддерживается, выходим');
        return;
      }

      // Не запрашиваем разрешение автоматически, только если уже есть
      if (store.support.hasPermission) {
        console.log('Автоматическая подписка на push уведомления...');

        // Проверяем готовность Service Worker с timeout
        if ('serviceWorker' in navigator) {
          console.log('Service Worker поддерживается, проверяем готовность...');

          // Проверяем статус Service Worker
          const registrations =
            await navigator.serviceWorker.getRegistrations();
          console.log('Текущие регистрации Service Worker:', registrations);

          if (registrations.length === 0) {
            console.log('Service Worker не зарегистрирован');
            return;
          }

          const isServiceWorkerReady = await Promise.race([
            navigator.serviceWorker.ready.then(() => {
              console.log('Service Worker готов');
              return true;
            }),
            new Promise<boolean>((resolve) => {
              setTimeout(() => {
                console.log(
                  'Timeout: Service Worker не готов в течение 3 секунд',
                );
                resolve(false);
              }, 3000);
            }),
          ]);

          if (!isServiceWorkerReady) {
            console.log(
              'Service Worker не готов, пропускаем автоматическую подписку',
            );
            return;
          }
        } else {
          console.log('Service Worker не поддерживается браузером');
          return;
        }

        console.log('Вызываем subscribe...');
        await subscribe();
      } else {
        console.log('Нет разрешения на уведомления');
      }
    } catch (error) {
      console.error('Ошибка автоматической подписки:', error);
      // Не показываем пользователю ошибку автоматической подписки
    }
  };

  return {
    // Состояние
    isProcessing,
    subscriptionState: store.subscriptionState,
    support: computed(() => store.support),

    // Computed
    canSubscribe,
    canUnsubscribe,
    subscriptionStatus,
    isThisDeviceSubscribed,
    hasActiveServiceWorker,

    // Методы
    initialize,
    updateSupport,
    requestPermission,
    resetPermission,
    forceRequestPermission,
    subscribe,
    unsubscribe,
    resubscribe,
    refreshDeviceState,
    autoSubscribeIfSupported,
    loadUserSubscriptions,
  };
}
