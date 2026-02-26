// processes/init-wallet/index.ts
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { useAccountStore } from 'src/entities/Account/model';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { extractGraphQLErrorMessages } from 'src/shared/api/errors';

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

    try {
      const userAccount = await account.getAccount(session.username);

      // Устанавливаем аккаунт текущего пользователя в сессию
      if (userAccount) {
        session.setCurrentUserAccount(userAccount);
      }

      await wallet.loadUserWallet({
        coopname: info.coopname,
        username: session.username,
      });

      session.loadComplete = true;

      // Выключаем лоадер только при первой инициализации после входа
      if (!wasLoadComplete) {
        desktops.setWorkspaceChanging(false);
      }
    } catch (e: any) {
      console.error('Ошибка при инициализации кошелька:', e);

      // Используем тот же подход для извлечения сообщений об ошибках, что и в alerts.ts
      const errorMessage = extractGraphQLErrorMessages(e);

      // Проверяем на ошибку недействительного JWT токена
      if (errorMessage.includes('Пользователь с указанным JWT не найден') ||
          errorMessage.includes('jwt') ||
          errorMessage.includes('token') ||
          errorMessage.includes('авторизац')) {

        console.warn('Обнаружена ошибка авторизации при инициализации, выполняем автоматический logout');

        // Выполняем logout
        session.close();
        await desktops.setWorkspaceChanging(false);

        // Обновляем страницу для полной очистки состояния
        setTimeout(() => {
          window.location.reload();
        }, 100);

        return;
      }

      // Выключаем лоадер при ошибке, но только если это была первая инициализация
      if (!wasLoadComplete) {
        desktops.setWorkspaceChanging(false);
      }
    }

    // Единократная загрузка — обновления через WebSocket подписки
  };

  return { run };
}
