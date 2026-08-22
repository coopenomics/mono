import { ref, computed } from 'vue';
import { loadProviderSubscriptions } from '../api';
import { useSystemStore } from 'src/entities/System/model';
import { Queries } from '@coopenomics/sdk';

/**
 * Специфичные данные для подписки на хостинг
 */
export interface HostingSubscriptionData {
  subscription_type_id: 1;
  progress: number;
  is_valid: boolean;
  is_delegated: boolean;
}

/**
 * Специфичные данные подписки (union тип для всех типов подписок)
 */
export type SubscriptionSpecificData = HostingSubscriptionData | null;

/**
 * Тип подписки провайдера из GraphQL API
 */
export type ProviderSubscription = Queries.System.GetProviderSubscriptions.IOutput[typeof Queries.System.GetProviderSubscriptions.name][number];

// Курс конвертации AXON в валюту системы (RUB)
export const AXON_GOVERN_RATE = 10; // 1 AXON = 10 RUB

/**
 * Composable для работы с подписками провайдера
 */
export function useProviderSubscriptions() {
  const system = useSystemStore();
  const subscriptions = ref<ProviderSubscription[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // IP адрес сервера для делегирования домена
  const SERVER_IP = '51.250.114.13';

  // Получить подписку на хостинг (id=1)
  const hostingSubscription = computed(() =>
    subscriptions.value.find(sub => sub.subscription_type_id === 1)
  );

  // Статус валидности домена для хостинг подписки (из specific_data)
  const domainValid = computed(() => {
    const specificData = hostingSubscription.value?.specific_data as SubscriptionSpecificData;
    return (specificData?.is_valid && specificData?.is_delegated) ?? null;
  });

  // Прогресс установки для хостинг подписки (из specific_data)
  const installationProgress = computed(() => {
    const specificData = hostingSubscription.value?.specific_data as SubscriptionSpecificData;
    return specificData?.progress ?? null;
  });

  // Статус инстанса для хостинг подписки (пока оставляем как есть, может поле будет добавлено позже)
  const instanceStatus = computed(() =>
    hostingSubscription.value?.instance_status ?? null
  );

  /**
   * Загрузить подписки пользователя
   */
  const loadSubscriptions = async () => {
    // Проверяем доступность провайдера
    console.log('system.info', system.info);
    if (!system.info.is_providered) {
      error.value = 'Функционал провайдера не доступен';
      return;
    }

    try {
      isLoading.value = true;
      error.value = null;
      subscriptions.value = await loadProviderSubscriptions();
      console.log('subscriptions', subscriptions.value);
    } catch (err: any) {
      error.value = err.message || 'Ошибка загрузки подписок';
      console.error('Error loading provider subscriptions:', err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Автоматическая загрузка с интервалом
   */
  const startAutoRefresh = (intervalMs = 60000) => { // 1 минута по умолчанию
    loadSubscriptions(); // Первая загрузка

    const interval = setInterval(() => {
      loadSubscriptions();
    }, intervalMs);

    // Функция для остановки автообновления
    const stop = () => clearInterval(interval);

    return stop;
  };

  return {
    subscriptions,
    isLoading,
    error,
    hostingSubscription,
    domainValid,
    installationProgress,
    instanceStatus,
    loadSubscriptions,
    startAutoRefresh,
    SERVER_IP,
  };
}
