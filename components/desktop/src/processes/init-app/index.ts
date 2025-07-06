import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useInitWalletProcess } from 'src/processes/init-wallet';
import type { Router } from 'vue-router';
import { useBranchOverlayProcess } from '../watch-branch-overlay';
import { setupNavigationGuard } from '../navigation-guard-setup';
import { useInitExtensionsProcess } from 'src/processes/init-installed-extensions';
import { applyThemeFromStorage } from 'src/shared/lib/utils';
import { useSessionStore } from 'src/entities/Session';

export async function useInitAppProcess(router: Router) {
  applyThemeFromStorage();
  const system = useSystemStore();
  await system.loadSystemInfo();

  const desktops = useDesktopStore();
  await desktops.healthCheck();
  await desktops.loadDesktop();

  // Регистрируем маршруты рабочего стола до выбора активного рабочего стола
  desktops.registerWorkspaceMenus(router);

  await useInitWalletProcess().run();

  // Выбираем рабочий стол на основе прав пользователя или сохраненного выбора
  // только если пользователь авторизован
  const session = useSessionStore();
  if (session.isAuth) {
    desktops.selectDefaultWorkspace();
  }

  useBranchOverlayProcess();

  setupNavigationGuard(router);

  await useInitExtensionsProcess(router);
}
