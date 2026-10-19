import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { goToReturnAfterAuth } from 'src/shared/lib/navigation';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { updateOpenReplayUser } from 'src/shared/config';

/**
 * Вход состоялся — открыть пайщику стол: регистрацию, если она не закончена,
 * иначе страницу, с которой его увели на вход, либо стол по умолчанию. Общий
 * хвост формы входа и страницы приглашения, где пароль задаётся и сразу же
 * открывает кабинет. Инъекции берутся при вызове composable (setup-контекст).
 */
export function useEnterDesktop() {
  const router = useRouter();
  const session = useSessionStore();
  const system = useSystemStore();
  const desktops = useDesktopStore();

  function untilLoadComplete(): Promise<void> {
    if (session.loadComplete) return Promise.resolve();
    return new Promise((resolve) => {
      const stop = watch(
        () => session.loadComplete,
        (done) => {
          if (!done) return;
          stop();
          resolve();
        },
      );
    });
  }

  async function enterDesktop(): Promise<void> {
    updateOpenReplayUser({
      username: session.username,
      coopname: system.info.coopname,
      cooperativeDisplayName: system.cooperativeDisplayName,
    });

    if (!session.isRegistrationComplete) {
      desktops.setWorkspaceChanging(false);
      void router.push({ name: 'signup' });
      return;
    }
    // Стол читаем, когда контекст пайщика поднят: init-wallet ставит
    // loadComplete в любом исходе (успех, сбой, свой таймаут) — ждём факта,
    // а не опрашиваем флаг по таймеру.
    await untilLoadComplete();
    try {
      await desktops.loadDesktop();
    } catch (e) {
      console.warn('[BOOTRACE] не удалось перезагрузить стол после входа:', e);
    }
    if (!goToReturnAfterAuth(router)) {
      desktops.selectDefaultWorkspace(true);
      desktops.goToDefaultPage(router);
    }
    if (session.loadComplete) {
      desktops.setWorkspaceChanging(false);
    }
  }

  return { enterDesktop };
}
