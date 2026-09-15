import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useUpdateWatch } from 'src/entities/AppVersion/model';
import { useInitWalletProcess } from 'src/processes/init-wallet';
import type { Router } from 'vue-router';
import { watch } from 'vue';
import { useBranchOverlayProcess } from '../watch-branch-overlay';
import { useExitOverlayProcess } from '../watch-exit-overlay';
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

/** Ответ SSR-middleware `sessionContext`: кто запросил документ. */
interface ServerSessionContext {
  status: 'guest' | 'active' | 'expired' | 'unknown';
  username?: string;
  account?: unknown;
  desktop?: unknown;
}

function readServerSession(ssrContext: unknown): ServerSessionContext | null {
  const locals = (ssrContext as { res?: { locals?: { coopSession?: ServerSessionContext } } } | null | undefined)?.res
    ?.locals;
  return locals?.coopSession ?? null;
}

export async function useInitAppProcess(router: Router, ssrContext?: unknown) {
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
    // Состояние узла нужно до первой отрисовки: если он ещё догоняет цепь,
    // рабочий стол обязан закрыться заглушкой сразу, а не через тик мониторинга.
    void system.loadNodeSyncState();
    system.startSystemMonitoring();
    // Опрос self-report версии ноды (/version) → тост об обновлении.
    // Заменяет ненадёжный триггер от lifecycle service worker'а.
    useUpdateWatch().start();
  }

  const desktops = useDesktopStore();
  const session = useSessionStore();

  // Восстанавливаем сессию (прикрепляем JWT к client) ДО первого getDesktop.
  // Видимость grant-столов расширений (market и пр.) выводится из `grants`,
  // которые backend считает по АВТОРИЗОВАННОМУ пользователю. На холодной
  // перезагрузке client пересоздаётся без токена; если getDesktop уходит
  // гостем — grant-столы получают пустой набор прав и не отображаются, а
  // повторного refetch после восстановления сессии нет (init-wallet грузит
  // только account/wallet). Поэтому раньше столы расширения «появлялись»
  // только после ручного вкл/выкл расширения (EnableButton зовёт loadDesktop
  // уже авторизованным). session.init идемпотентен (guard hasCreditials) —
  // повторный вызов внутри init-wallet станет no-op.
  // Серверный рендер: личность и данные пришли из SSR-middleware по cookie
  // сессии — кладём их в сторы и не ходим за гостевым столом. Клиент после
  // гидрации получит стол и аккаунт пайщика уже в состоянии, а ключи и токены
  // восстановит сам в `session.init()`.
  const serverSession = isServer ? readServerSession(ssrContext) : null;
  if (serverSession?.status === 'active' && serverSession.username) {
    session.applyServerSession({
      username: serverSession.username,
      account: (serverSession.account as Parameters<typeof session.applyServerSession>[0]['account']) ?? null,
    });
    if (serverSession.desktop) {
      desktops.applyServerDesktop(
        serverSession.desktop as Parameters<typeof desktops.applyServerDesktop>[0],
        serverSession.username,
      );
    }
    bootrace('server session applied');
  } else if (serverSession?.status === 'expired') {
    session.markServerSessionExpired();
    bootrace('server session expired');
  }

  try {
    await session.init();
  } catch (error) {
    console.warn('Session init before desktop load failed:', error);
  }

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
    // Стол уже пришёл с сервера для этого пайщика (или гидратирован на клиенте
    // из серверного состояния) — повторный запрос не нужен и вреден: во время
    // обрыва связи он привозил гостевой стол поверх настоящего.
    if (desktops.currentDesktop && desktops.loadedForUsername && desktops.loadedForUsername === session.username) {
      bootrace('desktop from server — skip loadDesktop');
    } else {
      await desktops.loadDesktop();
      bootrace('loadDesktop OK');
    }
  } catch (error) {
    bootrace('loadDesktop FAIL');
    console.warn('Failed to load desktop configuration:', error);
    // Продолжаем инициализацию даже при ошибках загрузки десктопа
  }

  // Регистрируем маршруты рабочего стола до выбора активного рабочего стола
  desktops.registerWorkspaceMenus(router);
  bootrace(`registerWorkspaceMenus done (routes=${router.getRoutes().length})`);

  // На сервере кошелёк и контекст пайщика не грузим: аккаунт уже пришёл из
  // SSR-middleware, а запросы от имени пайщика сервер делать не может — у него
  // нет токенов, только cookie сессии.
  if (!isServer) {
    await useInitWalletProcess().run();
    bootrace('initWallet done');
  }

  // Выбираем authorized-рабочий стол только если пайщик принят советом
  // (status='active'). На промежуточных статусах оставляем дефолтный
  // (non_authorized) — публичную главную.
  if (session.isFullyActive) {
    desktops.selectDefaultWorkspace();
  }

  useBranchOverlayProcess();
  useExitOverlayProcess();

  // На сервере гвард получает ответ документа: 401/403 ставятся им же.
  setupNavigationGuard(
    router,
    isServer ? ((ssrContext as { res?: { statusCode?: number } } | null | undefined)?.res ?? null) : null,
  );
  bootrace('navigationGuard installed');

  // Бэкенд вернулся после паузы (dev-рестарт, апгрейд): данные, от которых
  // зависят права (аккаунт → роль, стол → гранты), могли не загрузиться на
  // старте и сами не обновляются — гард в таком состоянии уводил на
  // «Недостаточно прав доступа». Перечитываем их при переходе
  // backendAvailable false → true.
  if (!isServer) {
    watch(
      () => system.backendAvailable,
      (ok, was) => {
        if (!ok || was !== false || !session.isAuth) return;
        bootrace('backend is back — reloading desktop & account');
        desktops
          .loadDesktop()
          .catch((e) => console.warn('Reload desktop after backend recovery failed:', e));
        useInitWalletProcess()
          .run(true)
          .catch((e) => console.warn('Reload account after backend recovery failed:', e));
      },
    );
  }

  await useInitExtensionsProcess(router);
  bootrace(`initExtensions done (routes=${router.getRoutes().length})`);

  // Досинхронизация активного стола с текущим маршрутом ПОСЛЕ установки расширений.
  // afterEach начального перехода мог сработать раньше, чем install прикрепил
  // маршруты к workspace'ам (mainRoute ещё был null) — поэтому при холодном
  // deep-link на /market-supplier/* активным мог остаться дефолтный стол.
  desktops.syncActiveWorkspaceFromRoute(
    router.currentRoute.value.matched.map((r) => r.name ?? null),
  );

}
