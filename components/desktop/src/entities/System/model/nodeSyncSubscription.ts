import { Subscriptions } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { RealtimeSubscription } from 'src/shared/lib/realtime';
import { useSystemStore } from './store';

// Модуль намеренно не попадает в бочку `model`: её импортируют повсеместно, а
// ws-транспорт нужен ровно одному месту — регистрации подписок ядра.

/**
 * Подписка ядра на ход догона цепи узлом кооператива.
 *
 * В отличие от подписок расширений, эта несёт само состояние, а не сигнал
 * дочитать: полезной нагрузки в ней несколько чисел, и лишний запрос за ними
 * бессмысленен. Дочитка (`resync`) остаётся страховкой на возврат вкладки и
 * оборванный сокет — там же выясняется, что узел не отвечает вовсе.
 */
export function createNodeSyncSubscription(): RealtimeSubscription {
  return {
    id: 'core:node-sync',
    open() {
      const system = useSystemStore();

      const stream = client.Subscription('subscription')(
        Subscriptions.System.NodeSyncState.subscription,
      );

      stream.on((payload) => {
        const state = (payload as Subscriptions.System.NodeSyncState.IOutput | undefined)
          ?.nodeSyncState;
        if (state) system.syncState = state;
      });

      // Реконнект: пока сокет молчал, узел мог и уйти в догон, и выйти из него.
      stream.open(() => {
        void system.loadNodeSyncState();
      });

      stream.error((err: unknown) => {
        console.warn('[node-sync] ws-ошибка подписки (реконнект сам)', err);
      });

      // Транспорт подписок общий с расширениями, поэтому здесь закрывается
      // только свой сокет: `disposeSubscriptions()` оборвал бы и чужие.
      return {
        close: () => stream.ws.close(),
      };
    },
    resync() {
      return useSystemStore().loadNodeSyncState();
    },
  };
}
