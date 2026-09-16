import { Subscriptions } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { RealtimeSubscription } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from './stores';

// Модуль намеренно не попадает в бочку `model`: её импортируют повсеместно, а
// ws-транспорт нужен ровно одному месту — регистрации подписок ядра.

/**
 * Подписка ядра на изменения кошельков пайщика.
 *
 * Сервер публикует сигнал на дельте цепи (`ledger2::userwallets`), клиент по
 * нему дочитывает остаток. Без неё карточка пайщика узнавала о пополнении
 * только при следующем поводе перечитать кошелёк, и деньги появлялись позже
 * уведомления об их приёме — пайщик видел «0,00» уже после «платёж принят».
 *
 * Суммы в payload не передаём намеренно: авторитетное состояние живёт в цепи, а
 * две дороги к одному числу неизбежно расходятся.
 */
export function createWalletEventsSubscription(): RealtimeSubscription {
  return {
    id: 'core:wallet-events',
    open() {
      const coopname = useSystemStore().info.coopname;
      const stream = client.Subscription('subscription')(
        Subscriptions.Wallet.WalletEvents.subscription,
        { variables: { input: { coopname } } },
      );

      stream.on((payload) => {
        const event = (payload as Subscriptions.Wallet.WalletEvents.IOutput | undefined)
          ?.walletEvents;
        if (!event) return;
        void reloadWallet();
      });

      // Пока сокет молчал, остаток мог измениться — дочитываем на реконнекте.
      stream.open(() => {
        void reloadWallet();
      });

      stream.error((err: unknown) => {
        console.warn('[wallet] ws-ошибка подписки (реконнект сам)', err);
      });

      // Транспорт подписок общий с расширениями, поэтому закрываем только свой
      // сокет: `disposeSubscriptions()` оборвал бы и чужие.
      return {
        close: () => stream.ws.close(),
      };
    },
    resync() {
      return reloadWallet();
    },
  };
}

/** Дочитка кошелька текущего пайщика; без входа в систему делать нечего. */
async function reloadWallet(): Promise<void> {
  const username = useSessionStore().username;
  if (!username) return;
  const coopname = useSystemStore().info.coopname;
  if (!coopname) return;
  await useWalletStore().loadUserWallet({ coopname, username });
}
