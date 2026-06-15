import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useUpdateWatch } from 'src/entities/AppVersion/model';
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

// [BOOTRACE] Диагностика порядка инициализации первого холодного старта.
// Грепается по слову BOOTRACE. Логируем только на клиенте — гонка именно там.
function bootrace(stage: string): void {
  if (isServer) return;
  let ts = '?';
  try {
    ts = `${Math.round(performance.now())}ms`;
  } catch {
    /* noop */
  }
  console.log(`[BOOTRACE] ${ts} initApp: ${stage}`);
}

export async function useInitAppProcess(router: Router) {
  bootrace('start');
  applyThemeFromStorage();
  const system = useSystemStore();

  try {
    await system.loadSystemInfo();
    bootrace('loadSystemInfo OK');

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
    bootrace('loadSystemInfo FAIL');
    console.warn('Failed to load initial system info, backend might be unavailable:', error);
    // Продолжаем инициализацию даже при недоступности бэкенда
  }

  // Запускаем мониторинг системной информации для отслеживания статуса
  // Метод startSystemMonitoring сам проверяет SSR, но явная проверка здесь
  // делает код более понятным и предотвращает лишние вызовы
  if (!isServer) {
    system.startSystemMonitoring();
    // Опрос self-report версии ноды (/version) → тост об обновлении.
    // Заменяет ненадёжный триггер от lifecycle service worker'а.
    useUpdateWatch().start();
  }

  const desktops = useDesktopStore();

  // [SSR-HYDRATION FIX] При SSR-заходе Pinia гидратируется серверным состоянием,
  // где workspaces[].routes сериализованы ВМЕСТЕ с component. Vue-компонент не
  // переживает JSON (__INITIAL_STATE__): render-функция выпадает, маршруты
  // становятся «мёртвыми». registerWorkspaceMenus регистрировал их в router,
  // initExtensions живые не добавлял («маршрут уже есть») → пустой рендер на
  // ВСЕХ страницах до F5 (после F5 SW отдаёт SPA-shell без гидратации — потому
  // и «лечилось» перезагрузкой). Чистим routes ДО loadDesktop, иначе его merge
  // перетащит мусор в новый desktop; живые маршруты добавит
  // useInitExtensionsProcess ниже — ровно как при SPA-заходе.
  if (!isServer && desktops.currentDesktop?.workspaces?.length) {
    let cleaned = 0;
    desktops.currentDesktop.workspaces.forEach((ws) => {
      if ((ws as { routes?: unknown }).routes) {
        delete (ws as { routes?: unknown }).routes;
        cleaned++;
      }
    });
    if (cleaned > 0) bootrace(`SSR-hydrated routes stripped (${cleaned} workspaces)`);
  }

  try {
  await desktops.loadDesktop();
  bootrace('loadDesktop OK');
  } catch (error) {
    bootrace('loadDesktop FAIL');
    console.warn('Failed to load desktop configuration:', error);
    // Продолжаем инициализацию даже при ошибках загрузки десктопа
  }

  // Регистрируем маршруты рабочего стола до выбора активного рабочего стола
  desktops.registerWorkspaceMenus(router);
  bootrace(`registerWorkspaceMenus done (routes=${router.getRoutes().length})`);

  await useInitWalletProcess().run();
  bootrace('initWallet done');

  // Выбираем authorized-рабочий стол только если пайщик принят советом
  // (status='active'). На промежуточных статусах оставляем дефолтный
  // (non_authorized) — публичную главную.
  const session = useSessionStore();
  if (session.isFullyActive) {
    desktops.selectDefaultWorkspace();
  }

  useBranchOverlayProcess();

  setupNavigationGuard(router);
  bootrace('navigationGuard installed');

  await useInitExtensionsProcess(router);
  bootrace(`initExtensions done (routes=${router.getRoutes().length})`);

}
