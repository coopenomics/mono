import { Subscriptions } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSystemStore } from 'src/entities/System/model';
import type { RealtimeSubscription } from 'src/shared/lib/realtime';
import {
  dispatchMarketplaceEvent,
  resyncMarketplaceConsumers,
  type MarketplaceRealtimeEvent,
} from 'src/shared/lib/marketplace';
import { useOnsiteSignatureGate } from './useOnsiteSignatureGate';

/**
 * Подписка расширения «Стол заказов» на realtime-канал marketplace.
 * Регистрируется в install.ts через реестр ядра (registerRealtimeSubscription) —
 * App про неё не знает.
 *
 * Единственный ws на расширение, события разнотипны. Маршрутизация по
 * `__typename`:
 *  - личные события гейта (заказ готов / приёмка ждёт подписи) → дочитка гейта;
 *  - остальные (каталог: остаток/публикация) → диспетчер, откуда их разбирают
 *    подписанные страницы (`useMarketplaceRealtime`).
 * Принцип «сигнал, а не данные» сохраняется: payload несёт только идентификаторы.
 */
const GATE_EVENT_TYPES = new Set<MarketplaceRealtimeEvent['__typename']>([
  'MarketplaceOrderReadyToReceiveEvent',
  'MarketplaceReceptionPendingSignEvent',
  // Статусные сигналы закрывают гейт кросс-девайсно: подписал на телефоне —
  // оверлей на десктопе уходит сразу, а не по 60-сек страховке. Дочитка
  // дешёвая, события по своему аккаунту редкие.
  'MarketplaceOrderStatusChangedEvent',
  'MarketplaceAplReceptionStatusChangedEvent',
  // Докладка со склада кооператива (requirement 76): предложение всплывает в
  // гейте немедленно; разрешение (принял/отозвано) — закрывает его.
  'MarketplaceStockProposalCreatedEvent',
  'MarketplaceStockProposalResolvedEvent',
]);

/** Схлопывает шквал open при флапающем бэкенде (рестарт/checkout ветки). */
const CATCH_UP_DEBOUNCE_MS = 2_000;

export function createMarketplaceEventsSubscription(): RealtimeSubscription {
  return {
    id: 'marketplace:events',
    open() {
      const coopname = useSystemStore().info.coopname;
      const gate = useOnsiteSignatureGate();

      const stream = client.Subscription('subscription')(
        Subscriptions.Marketplace.Events.subscription,
        { variables: { input: { coopname } } },
      );

      let catchUpTimer: ReturnType<typeof setTimeout> | null = null;
      const scheduleCatchUp = (reason: string) => {
        if (catchUpTimer) clearTimeout(catchUpTimer);
        catchUpTimer = setTimeout(() => {
          catchUpTimer = null;
          void gate.refresh(`ПОДПИСКА (${reason})`);
          resyncMarketplaceConsumers(reason);
        }, CATCH_UP_DEBOUNCE_MS);
      };

      // Сигнал пришёл → раздаём по типу: гейт дочитывает своё состояние,
      // каталожные события уходят подписанным страницам через диспетчер.
      stream.on((payload) => {
        const event = (payload as Subscriptions.Marketplace.Events.IOutput | undefined)
          ?.marketplaceEvents;
        if (!event) return;
        if (GATE_EVENT_TYPES.has(event.__typename)) {
          void gate.refresh('ПОДПИСКА (ws-сигнал)');
        }
        dispatchMarketplaceEvent(event);
      });

      // graphql-ws сам реконнектит; catch-up debounce'им — иначе при дрожащем
      // бэкенде каждый open → шквал refresh и вкладка встаёт.
      stream.open(() => {
        scheduleCatchUp('ws-реконнект');
      });

      // Транзиентная ошибка ws — реконнект отрабатывает сам, гасить не нужно,
      // но логируем: если сыпется ошибками — подписка по факту НЕ работает.
      stream.error((err: unknown) => {
        console.warn('[OnsiteGate] ⚠ ПОДПИСКА: ws-ошибка (реконнект сам)', err);
      });

      return {
        close: () => {
          if (catchUpTimer) {
            clearTimeout(catchUpTimer);
            catchUpTimer = null;
          }
          stream.ws.close();
          // Гасим shared-транспорт целиком: обрывает in-flight reconnect loop.
          client.disposeSubscriptions();
        },
      };
    },
    resync(reason?: string) {
      resyncMarketplaceConsumers(reason);
      return useOnsiteSignatureGate().refresh(reason ?? 'POLL (resync)');
    },
  };
}
