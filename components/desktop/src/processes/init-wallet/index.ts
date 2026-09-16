// processes/init-wallet/index.ts
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { extractGraphQLErrorMessages } from 'src/shared/api/errors';
import { loadUserContext } from './loadUserContext';

/** Ожидание GraphQL (в т.ч. цепочки уведомлений на бэкенде) не должно блокировать запуск приложения. */
const WALLET_INIT_TIMEOUT_MS = 25_000;

const WALLET_INIT_TIMEOUT_MESSAGE = 'WALLET_INIT_TIMEOUT';

function walletInitTimeoutPromise(): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error(WALLET_INIT_TIMEOUT_MESSAGE));
    }, WALLET_INIT_TIMEOUT_MS);
  });
}

export function useInitWalletProcess() {
  const session = useSessionStore();
  const desktops = useDesktopStore();

  const run = async (forceReload = false) => {
    await session.init();

    if (!session.isAuth) return;

    // Запоминаем, была ли уже загрузка завершена
    const wasLoadComplete = session.loadComplete;

    // При принудительной перезагрузке временно сбрасываем loadComplete
    if (forceReload) {
      session.loadComplete = false;
    }

    const finishFirstInitUi = () => {
      if (!wasLoadComplete) {
        desktops.setWorkspaceChanging(false);
      }
    };

    try {
      await Promise.race([
        // Аккаунт пайщика и его кошелёк — общий шаг, им же пользуется восстановление
        // доступа. Правки вносить в loadUserContext, а не копией здесь.
        loadUserContext(),
        walletInitTimeoutPromise(),
      ]);

      session.loadComplete = true;
      finishFirstInitUi();
    } catch (e: unknown) {
      console.error('Ошибка при инициализации кошелька:', e);

      const isTimeout =
        e instanceof Error && e.message === WALLET_INIT_TIMEOUT_MESSAGE;
      if (isTimeout) {
        console.warn(
          `Инициализация данных пользователя превысила ${WALLET_INIT_TIMEOUT_MS} мс (возможна недоступность API или внешних сервисов уведомлений). Интерфейс будет доступен без фонового ретрая — обновите страницу после восстановления бэкенда.`,
        );
      }

      // Отказ авторизации здесь больше не трактуется как «выйти и перезагрузить»:
      // судьбу сессии решает сервер при следующем рендере по cookie — истёкшую
      // он объявит сам, и клиент её закроет. Ошибка только в журнал.
      if (!isTimeout) {
        console.warn('Контекст пайщика не загружен:', extractGraphQLErrorMessages(e));
      }

      session.loadComplete = true;
      finishFirstInitUi();
    }

    // Без рекурсивного setTimeout(run, 10_000): при мёртвом бэкенде цикл
    // вместе с ws-reconnect вывешивал вкладку (self-DDoS).
  };

  return { run };
}
