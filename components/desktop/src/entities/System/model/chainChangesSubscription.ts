import { Subscriptions } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import {
  dispatchChainChange,
  resyncLiveConsumers,
  type RealtimeSubscription,
} from 'src/shared/lib/realtime';
import { useSystemStore } from './store';

// Модуль намеренно не попадает в бочку `model`: её импортируют повсеместно, а
// ws-транспорт нужен ровно одному месту — регистрации подписок ядра.

/**
 * Подписка ядра на ленту изменений цепи — одна на всё приложение.
 *
 * Сервер шлёт сигнал «в таблице изменилась строка», когда изменение уже в базе
 * узла; экраны, подключённые через `useLiveReload`, перечитывают свои данные.
 * Какие таблицы доступны пайщику, решает сервер: строки личных таблиц получает
 * только их владелец и совет.
 */
export function createChainChangesSubscription(): RealtimeSubscription {
  let alive = false;
  return {
    id: 'core:chain-changes',
    open() {
      const coopname = useSystemStore().info.coopname;
      const stream = client.Subscription('subscription')(
        Subscriptions.Chain.ChainChanges.subscription,
        { variables: { input: { coopname } } },
      );

      stream.on((payload) => {
        alive = true;
        const signal = (payload as Subscriptions.Chain.ChainChanges.IOutput | undefined)
          ?.chainChanges;
        if (signal) dispatchChainChange(signal);
      });

      // Пока сокет молчал, данные могли измениться — открытые экраны дочитывают.
      stream.open(() => {
        alive = true;
        // i18n-ignore: служебная метка причины дочитки, передаётся в код, до пайщика не доходит
        resyncLiveConsumers('реконнект', true);
      });

      stream.error((err: unknown) => {
        alive = false;
        console.warn('[chain-changes] ws-ошибка подписки (реконнект сам)', err);
      });

      return {
        // Жив и сокет, и сама операция: открытие сокета чужой подписки мёртвую
        // операцию не оживляет — её канал переоткроет ядро.
        isAlive: () => alive && stream.isActive(),
        close: () => {
          alive = false;
          stream.ws.close();
        },
      };
    },
    resync(reason) {
      // i18n-ignore: служебная метка причины дочитки, передаётся в код, до пайщика не доходит
      resyncLiveConsumers(reason ?? 'дочитка', alive);
    },
  };
}
