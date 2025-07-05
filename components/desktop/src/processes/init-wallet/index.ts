// processes/init-wallet/index.ts
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { useAccountStore } from 'src/entities/Account/model';
import { useDesktopStore } from 'src/entities/Desktop/model';

export function useInitWalletProcess() {
  const session = useSessionStore();
  const wallet = useWalletStore();
  const { info } = useSystemStore();
  const account = useAccountStore();
  const desktops = useDesktopStore();

  const run = async () => {
    await session.init();

    if (!session.isAuth) return;

    // Запоминаем, была ли уже загрузка завершена
    const wasLoadComplete = session.loadComplete;

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
    } catch (e) {
      console.error(e);
      // Выключаем лоадер при ошибке, но только если это была первая инициализация
      if (!wasLoadComplete) {
        desktops.setWorkspaceChanging(false);
      }
    }

    // фоновая проверка каждые 10 сек
    setTimeout(run, 10_000);
  };

  return { run };
}
