import { Subscriptions } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSystemStore } from 'src/entities/System/model';
import type { RealtimeSubscription } from 'src/shared/lib/realtime';
import { useOnsiteSignatureGate } from './useOnsiteSignatureGate';

/**
 * Подписка расширения «Стол заказов» на персональный realtime-канал пайщика.
 * Регистрируется в install.ts через реестр ядра (registerRealtimeSubscription) —
 * App про неё не знает.
 *
 * Модель «сигнал, а не данные»: на ЛЮБОЕ событие канала просто дочитываем
 * авторитетное состояние гейта (refresh) — он сам решит, что показать. Так
 * пропуск отдельных полей события не важен, а приватные данные по проводу не
 * ходят.
 */
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

      // Сигнал пришёл → дочитываем состояние (catch-up из БД).
      stream.on(() => {
        void gate.refresh();
      });

      // graphql-ws сам реконнектит; на каждый (ре)коннект — catch-up, чтобы
      // подхватить то, что прилетело, пока сокет был оборван. Тип Zeus
      // объявляет open() без аргумента, но реализация принимает listener
      // ('opened'-событие ws) — приводим к фактической сигнатуре.
      const onReopen = stream.open as unknown as (listener: () => void) => void;
      onReopen(() => {
        void gate.refresh();
      });

      // Транзиентная ошибка ws — реконнект отрабатывает сам, гасить не нужно.
      stream.error(() => undefined);

      return { close: () => stream.ws.close() };
    },
    resync() {
      return useOnsiteSignatureGate().refresh();
    },
  };
}
