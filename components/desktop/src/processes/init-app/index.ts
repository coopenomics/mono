import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useInitWalletProcess } from 'src/processes/init-wallet';
import type { Router } from 'vue-router';
import { useBranchOverlayProcess } from '../watch-branch-overlay';
import { setupNavigationGuard } from '../navigation-guard-setup';
import { useInitExtensionsProcess } from 'src/processes/init-installed-extensions';
import { applyThemeFromStorage } from 'src/shared/lib/utils';
import { useSessionStore } from 'src/entities/Session';
import { LocalStorage } from 'quasar';

// Проверка, работаем ли мы на сервере (SSR)
const isServer = typeof window === 'undefined';

export async function useInitAppProcess(router: Router) {
  applyThemeFromStorage();
  const system = useSystemStore();

  try {
    await system.loadSystemInfo();

    // Сохраняем реферала из URL, если он есть
    if (!isServer) {
      const url = new URL(window.location.href.replace('#/', ''));
      const ref = url.searchParams.get('r');

      if (ref && system.info.coopname) {
        console.log('Saving referer to local storage:', ref);
        LocalStorage.set(`${system.info.coopname}:referer`, ref);
      }
    }
  } catch (error) {
    console.warn('Failed to load initial system info, backend might be unavailable:', error);
    // Продолжаем инициализацию даже при недоступности бэкенда
  }

  // Запускаем мониторинг системной информации для отслеживания статуса
  // Метод startSystemMonitoring сам проверяет SSR, но явная проверка здесь
  // делает код более понятным и предотвращает лишние вызовы
  if (!isServer) {
    system.startSystemMonitoring();
  }

  const desktops = useDesktopStore();

  try {
  await desktops.loadDesktop();
  } catch (error) {
    console.warn('Failed to load desktop configuration:', error);
    // Продолжаем инициализацию даже при ошибках загрузки десктопа
  }

  // Регистрируем маршруты рабочего стола до выбора активного рабочего стола
  desktops.registerWorkspaceMenus(router);

  await useInitWalletProcess().run();

  // Выбираем authorized-рабочий стол только если пайщик принят советом
  // (status='active'). На промежуточных статусах оставляем дефолтный
  // (non_authorized) — публичную главную.
  const session = useSessionStore();
  if (session.isFullyActive) {
    desktops.selectDefaultWorkspace();
  }

  useBranchOverlayProcess();

  setupNavigationGuard(router);

  await useInitExtensionsProcess(router);

}
