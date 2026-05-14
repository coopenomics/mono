// processes/init-wallet/index.ts
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { useAccountStore } from 'src/entities/Account/model';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { extractGraphQLErrorMessages } from 'src/shared/api/errors';

/** Ожидание GraphQL (в т.ч. цепочки к Novu на бэкенде) не должно блокировать запуск приложения. */
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
  const wallet = useWalletStore();
  const { info } = useSystemStore();
  const account = useAccountStore();
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
        (async () => {
          const userAccount = await account.getAccount(session.username);

          if (userAccount) {
            session.setCurrentUserAccount(userAccount);
          }

          // Кошелёк и его документы (оферта цифрового кошелька и т.п.) —
          // только для пайщиков, принятых советом. На created/joined/payed/
          // registered коопеномический аккаунт ещё не активен; loadUserWallet
          // вернёт пустой кошелёк, а UI начнёт показывать подписи документов,
          // которых юзер на этом этапе подписывать не должен.
          if (session.isFullyActive) {
            await wallet.loadUserWallet({
              coopname: info.coopname,
              username: session.username,
            });
          }
        })(),
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
          `Инициализация данных пользователя превысила ${WALLET_INIT_TIMEOUT_MS} мс (возможна недоступность API или внешних сервисов уведомлений). Интерфейс будет доступен, повторная попытка загрузки — через фоновый цикл.`,
        );
      }

      const errorMessage = extractGraphQLErrorMessages(e);

      if (
        !isTimeout &&
        (errorMessage.includes('Пользователь с указанным JWT не найден') ||
          errorMessage.includes('jwt') ||
          errorMessage.includes('token') ||
          errorMessage.includes('авторизац'))
      ) {
        console.warn(
          'Обнаружена ошибка авторизации при инициализации, выполняем автоматический logout',
        );

        session.close();
        await desktops.setWorkspaceChanging(false);

        setTimeout(() => {
          window.location.reload();
        }, 100);

        return;
      }

      session.loadComplete = true;
      finishFirstInitUi();
    }

    // фоновая проверка каждые 10 сек (только если это не принудительная перезагрузка)
    if (!forceReload) {
      setTimeout(run, 10_000);
    }
  };

  return { run };
}
