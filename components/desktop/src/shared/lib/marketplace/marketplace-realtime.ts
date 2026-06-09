import { onMounted, onUnmounted } from 'vue';
import type { Subscriptions } from '@coopenomics/sdk';

/**
 * Диспетчер realtime-событий marketplace по `__typename`.
 *
 * Единственный ws-канал (`marketplace:events`, см. OnsiteSignatureGate) несёт
 * разнородные события — личные (заказ/приёмка) и каталог (остаток/публикация).
 * Слать всё всем потребителям расточительно: каждая страница реагирует только
 * на свои типы. Диспетчер — тонкий маршрутизатор: подписка кладёт сюда событие,
 * а зарегистрированные потребители получают только интересующие их типы.
 *
 * Принцип «сигнал, а не данные» сохраняется: обработчик по сигналу либо точечно
 * правит уже загруженное (по идентификатору из payload), либо дочитывает
 * авторитетное состояние query — payload несёт только идентификаторы.
 */
export type MarketplaceRealtimeEvent = NonNullable<
  Subscriptions.Marketplace.Events.IOutput['marketplaceEvents']
>;

export type MarketplaceRealtimeEventName = MarketplaceRealtimeEvent['__typename'];

type EventByName<N extends MarketplaceRealtimeEventName> = Extract<
  MarketplaceRealtimeEvent,
  { __typename: N }
>;

/** Карта обработчиков: ключ — `__typename`, значение получает сужённый тип. */
export type MarketplaceRealtimeHandlers = {
  [N in MarketplaceRealtimeEventName]?: (event: EventByName<N>) => void;
};

export interface MarketplaceRealtimeOptions {
  /**
   * Catch-up: вызывается на (ре)коннект ws, возврат вкладки и страховочный
   * resync канала — потребитель дочитывает состояние, чтобы подхватить
   * пропущенное, пока сокет был оборван.
   */
  onResync?: (reason?: string) => void;
}

interface Consumer {
  types: Set<string>;
  handlers: MarketplaceRealtimeHandlers;
  onResync?: (reason?: string) => void;
}

const consumers = new Set<Consumer>();

/**
 * Зарегистрировать потребителя напрямую (вне Vue-компонента). Возвращает
 * функцию снятия. Для компонентов используй `useMarketplaceRealtime`.
 */
export function registerMarketplaceConsumer(consumer: Consumer): () => void {
  consumers.add(consumer);
  return () => {
    consumers.delete(consumer);
  };
}

/** Вызывается подпиской на каждое пришедшее ws-событие. */
export function dispatchMarketplaceEvent(event: MarketplaceRealtimeEvent): void {
  for (const consumer of consumers) {
    if (!consumer.types.has(event.__typename)) continue;
    const handler = consumer.handlers[event.__typename] as
      | ((e: MarketplaceRealtimeEvent) => void)
      | undefined;
    handler?.(event);
  }
}

/** Вызывается подпиской на (ре)коннект / страховочный resync канала. */
export function resyncMarketplaceConsumers(reason?: string): void {
  for (const consumer of consumers) {
    consumer.onResync?.(reason);
  }
}

/**
 * Подписать компонент на realtime-события marketplace нужных типов. Регистрация
 * на `onMounted`, снятие на `onUnmounted` — пока страница открыта, она живая.
 */
export function useMarketplaceRealtime(
  handlers: MarketplaceRealtimeHandlers,
  options?: MarketplaceRealtimeOptions
): void {
  const consumer: Consumer = {
    types: new Set(Object.keys(handlers)),
    handlers,
    onResync: options?.onResync,
  };
  let unregister: (() => void) | undefined;
  onMounted(() => {
    unregister = registerMarketplaceConsumer(consumer);
  });
  onUnmounted(() => {
    unregister?.();
    unregister = undefined;
  });
}
